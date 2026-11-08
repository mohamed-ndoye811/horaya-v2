import {
  type Actor,
  adjustGiftCard,
  cancelBooking,
  cancelBookingWithToken,
  cancelGiftCard,
  createCounterBooking,
  createEvent,
  createEventBooking,
  createEventType,
  type Deps,
  ForbiddenError,
  markGiftCardPaid,
  publishEvent,
  purchaseGiftCard,
  updateGiftCardSettings,
  ValidationError,
} from "@horaya/core";
import { eq } from "drizzle-orm";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import {
  getGiftCardByViewToken,
  getGiftCardDetail,
  listGiftCards,
  listUsableGiftCardsForEmail,
} from "../src/queries";
import { booking, giftCard, payment } from "../src/schema";
import {
  contact,
  createOrganization,
  customerActor,
  db,
  fixedClock,
  member,
  testDeps,
} from "./helpers";

afterAll(() => db.$client.end());

let organizationId: string;
let owner: Actor;
let clock: ReturnType<typeof fixedClock>;
let deps: Deps;

beforeEach(async () => {
  organizationId = await createOrganization();
  owner = member(organizationId);
  clock = fixedClock();
  deps = testDeps(clock);
  await updateGiftCardSettings(deps, owner, {
    enabled: true,
    amountsCents: [3000, 5000],
    customAmount: false,
    minCents: 2000,
    maxCents: 30000,
    validityMonths: 12,
    message: null,
  });
});

const purchase = (actor: Actor, amountCents = 5000, paid = false) =>
  purchaseGiftCard(deps, actor, {
    amountCents,
    purchaserName: "Camille Roux",
    purchaserEmail: "camille.roux@mail.com",
    recipientName: "Léa Fontaine",
    recipientEmail: "",
    message: "Joyeux anniversaire",
    paid,
  });

/** Bon payé et actif, prêt à servir. */
async function activeCard(amountCents = 5000) {
  const card = await purchase(owner, amountCents, true);
  if (card.status !== "active") throw new Error("bon non activé");
  return card;
}

async function workshop(priceCents = 3500) {
  const type = await createEventType(deps, owner, { name: "Tournage", color: "#D8BC66" });
  const [created] = await createEvent(deps, owner, {
    eventTypeId: type.id,
    title: "Atelier tournage",
    startsAt: "2026-11-10T09:00:00Z",
    endsAt: "2026-11-10T12:00:00Z",
    timezone: "Europe/Paris",
    capacity: 8,
    priceCents,
    paymentMode: "online",
  });
  if (!created) throw new Error("événement");
  return publishEvent(deps, owner, created.id);
}

const balanceOf = async (id: string) =>
  (await getGiftCardDetail(db, organizationId, id, clock.now()))?.card.balanceCents;

describe("achat et activation", () => {
  it("un achat public attend le paiement : code lisible, solde nul, pas utilisable", async () => {
    const card = await purchase(customerActor(organizationId));
    expect(card).toMatchObject({ status: "pending", initialCents: 5000, source: "public_page" });
    expect(card.code).toMatch(/^CABIN-[A-Z2-9]{8}$/);
    expect(await balanceOf(card.id)).toBe(0);
  });

  it("marquer payé émet le bon : solde, échéance à 12 mois, journal", async () => {
    const pending = await purchase(customerActor(organizationId));
    const card = await markGiftCardPaid(deps, owner, pending.id);
    expect(card.status).toBe("active");
    expect(card.expiresAt?.toISOString()).toBe("2027-10-01T08:00:00.000Z");
    const detail = await getGiftCardDetail(db, organizationId, card.id, clock.now());
    expect(detail?.card).toMatchObject({ balanceCents: 5000, state: "active" });
    expect(detail?.movements.map((entry) => [entry.kind, entry.amountCents])).toEqual([
      ["issue", 5000],
    ]);
    await expect(markGiftCardPaid(deps, owner, card.id)).rejects.toThrow("n'attend pas");
  });

  it("refuse un montant non proposé côté public, l'accepte au comptoir (payé = actif)", async () => {
    await expect(purchase(customerActor(organizationId), 4200)).rejects.toBeInstanceOf(
      ValidationError,
    );
    const sold = await purchase(owner, 4200, true);
    expect(sold).toMatchObject({ status: "active", source: "counter" });
    expect(await balanceOf(sold.id)).toBe(4200);
  });

  it("refuse la vente publique quand les bons sont désactivés", async () => {
    await updateGiftCardSettings(deps, owner, {
      enabled: false,
      amountsCents: [5000],
      customAmount: false,
      minCents: 2000,
      maxCents: 30000,
      validityMonths: 12,
    });
    await expect(purchase(customerActor(organizationId))).rejects.toThrow("ne vend pas");
  });

  it("un lecteur ne peut pas vendre", async () => {
    await expect(purchase(member(organizationId, "viewer"))).rejects.toBeInstanceOf(ForbiddenError);
  });
});

describe("utilisation sur une réservation", () => {
  it("utilisation partielle : le reste du solde est gardé, le reste à payer demeure", async () => {
    const card = await activeCard(10000);
    const event = await workshop(3500);
    const { booking: created, giftCardCents } = await createEventBooking(
      deps,
      customerActor(organizationId),
      {
        eventId: event.id,
        seats: 1,
        customer: contact(),
        giftCardCode: ` ${card.code.toLowerCase()} `,
      },
    );
    expect(giftCardCents).toBe(3500);
    expect(created.paymentStatus).toBe("none");
    // Le prix est entièrement couvert : le bon a été déduit et la réservation est payée.
    const [row] = await db.select().from(booking).where(eq(booking.id, created.id));
    expect(row?.paymentStatus).toBe("paid");
    expect(await balanceOf(card.id)).toBe(6500);
    const [paid] = await db.select().from(payment).where(eq(payment.bookingId, created.id));
    expect(paid).toMatchObject({ amountCents: 3500, provider: "gift_card", method: "gift_card" });
  });

  it("solde insuffisant : tout le solde part, il reste un complément à payer", async () => {
    const card = await activeCard(3000);
    const event = await workshop(3500);
    const { booking: created, giftCardCents } = await createEventBooking(
      deps,
      customerActor(organizationId),
      { eventId: event.id, seats: 1, customer: contact(), giftCardCode: card.code },
    );
    expect(giftCardCents).toBe(3000);
    const [row] = await db.select().from(booking).where(eq(booking.id, created.id));
    expect(row?.paymentStatus).toBe("none");
    expect(await balanceOf(card.id)).toBe(0);
    expect(
      await listUsableGiftCardsForEmail(db, organizationId, "camille.roux@mail.com", clock.now()),
    ).toHaveLength(0);
  });

  it("code inconnu, bon en attente, annulé ou expiré : refusé, rien n'est écrit", async () => {
    const event = await workshop();
    const pending = await purchase(customerActor(organizationId));
    const expired = await activeCard();
    await db
      .update(giftCard)
      .set({ expiresAt: new Date("2026-09-30T00:00:00Z") })
      .where(eq(giftCard.id, expired.id));
    const cancelled = await activeCard();
    await cancelGiftCard(deps, owner, cancelled.id, "erreur");
    const tryCode = (giftCardCode: string) =>
      createEventBooking(deps, customerActor(organizationId), {
        eventId: event.id,
        seats: 1,
        customer: contact(),
        giftCardCode,
      });
    for (const code of ["CABIN-ZZZZ", pending.code, cancelled.code, expired.code]) {
      await expect(tryCode(code)).rejects.toBeInstanceOf(ValidationError);
    }
    expect(await db.select().from(booking).where(eq(booking.eventId, event.id))).toHaveLength(0);
  });

  it("un bon d'un autre espace n'est pas reconnu", async () => {
    const card = await activeCard();
    const otherId = await createOrganization("AUT");
    const other = member(otherId);
    const type = await createEventType(deps, other, { name: "Autre", color: "#D8BC66" });
    const [created] = await createEvent(deps, other, {
      eventTypeId: type.id,
      title: "Autre atelier",
      startsAt: "2026-11-10T09:00:00Z",
      endsAt: "2026-11-10T12:00:00Z",
      timezone: "Europe/Paris",
      capacity: 8,
      priceCents: 3500,
      paymentMode: "online",
    });
    const event = await publishEvent(deps, other, created?.id ?? "");
    await expect(
      createEventBooking(deps, customerActor(otherId), {
        eventId: event.id,
        seats: 1,
        customer: contact(),
        giftCardCode: card.code,
      }),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it("deux réservations simultanées ne dépensent jamais plus que le solde", async () => {
    const card = await activeCard(5000);
    const event = await workshop(3500);
    const results = await Promise.allSettled(
      ["a@mail.com", "b@mail.com"].map((email) =>
        createEventBooking(deps, customerActor(organizationId), {
          eventId: event.id,
          seats: 1,
          customer: contact(email),
          giftCardCode: card.code,
        }),
      ),
    );
    expect(results.every((result) => result.status === "fulfilled")).toBe(true);
    expect(await balanceOf(card.id)).toBe(0);
  });

  it("au comptoir : bon déduit puis reste encaissé", async () => {
    const card = await activeCard(2000);
    const event = await workshop(3500);
    const { booking: created } = await createCounterBooking(deps, owner, {
      eventId: event.id,
      seats: 1,
      customer: { firstName: "Léa", lastName: "Fontaine", phone: "0700000000" },
      paid: true,
      paymentMethod: "cash",
      giftCardCode: card.code,
    });
    expect(created.paymentStatus).toBe("paid");
    const rows = await db.select().from(payment).where(eq(payment.bookingId, created.id));
    expect(rows.map((row) => [row.provider, row.amountCents]).sort()).toEqual([
      ["gift_card", 2000],
      ["manual", 1500],
    ]);
    expect(await balanceOf(card.id)).toBe(0);
  });
});

describe("annulation de la réservation", () => {
  async function bookedWith(card: { code: string }, priceCents = 3500) {
    const event = await workshop(priceCents);
    const { booking: created, manageToken } = await createEventBooking(
      deps,
      customerActor(organizationId),
      { eventId: event.id, seats: 1, customer: contact(), giftCardCode: card.code },
    );
    return { created, manageToken };
  }

  it("annulée par le client dans le délai : le montant retourne au bon", async () => {
    const card = await activeCard(5000);
    const { manageToken } = await bookedWith(card);
    expect(await balanceOf(card.id)).toBe(1500);
    await cancelBookingWithToken(deps, organizationId, manageToken);
    expect(await balanceOf(card.id)).toBe(5000);
    const detail = await getGiftCardDetail(db, organizationId, card.id, clock.now());
    expect(detail?.movements.map((entry) => entry.kind)).toEqual(["issue", "use", "restore"]);
  });

  it("annulée tard par le client : remboursement selon la politique (50 %)", async () => {
    const card = await activeCard(5000);
    const { manageToken } = await bookedWith(card);
    clock.set(new Date("2026-11-09T09:00:00Z"));
    await cancelBookingWithToken(deps, organizationId, manageToken);
    // 3 500 utilisés, 50 % rendus : 1 500 + 1 750.
    expect(await balanceOf(card.id)).toBe(3250);
  });

  it("annulée par l'organisateur : tout est rendu, une seule fois", async () => {
    const card = await activeCard(5000);
    const { created } = await bookedWith(card);
    await cancelBooking(deps, owner, created.id);
    expect(await balanceOf(card.id)).toBe(5000);
    await expect(cancelBooking(deps, owner, created.id)).rejects.toThrow();
    expect(await balanceOf(card.id)).toBe(5000);
  });
});

describe("gestion par l'organisateur", () => {
  it("ajustement avec raison, jamais sous zéro ; annulation retire le solde", async () => {
    const card = await activeCard(5000);
    await adjustGiftCard(deps, owner, card.id, -1000, "Geste commercial");
    expect(await balanceOf(card.id)).toBe(4000);
    await expect(adjustGiftCard(deps, owner, card.id, -5000, "Trop")).rejects.toThrow("négatif");
    await expect(adjustGiftCard(deps, owner, card.id, 500, " ")).rejects.toBeInstanceOf(
      ValidationError,
    );
    await cancelGiftCard(deps, owner, card.id, "Remboursé");
    const detail = await getGiftCardDetail(db, organizationId, card.id, clock.now());
    expect(detail?.card).toMatchObject({ balanceCents: 0, state: "cancelled" });
    expect(detail?.movements.map((entry) => entry.kind)).toEqual(["issue", "adjust", "cancel"]);
    await expect(adjustGiftCard(deps, owner, card.id, 100, "Après")).rejects.toThrow("actif");
  });

  it("liste, recherche et page imprimable par jeton", async () => {
    const card = await activeCard(5000);
    await purchase(customerActor(organizationId), 3000);
    expect(await listGiftCards(db, organizationId, clock.now())).toHaveLength(2);
    expect(await listGiftCards(db, organizationId, clock.now(), card.code.slice(-4))).toHaveLength(
      1,
    );
    const found = await getGiftCardByViewToken(db, organizationId, card.viewToken, clock.now());
    expect(found).toMatchObject({ id: card.id, balanceCents: 5000, state: "active" });
    expect(await getGiftCardByViewToken(db, organizationId, "inconnu", clock.now())).toBeNull();
    // Bloc « Mes bons cadeaux » : retrouvés par l'e-mail de l'acheteur.
    expect(
      await listUsableGiftCardsForEmail(db, organizationId, "CAMILLE.roux@mail.com", clock.now()),
    ).toHaveLength(1);
  });
});
