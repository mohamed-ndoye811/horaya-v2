import {
  type Actor,
  adjustPass,
  cancelBooking,
  cancelBookingWithToken,
  cancelEvent,
  createCounterBooking,
  createEvent,
  createEventType,
  createPassPlan,
  type Deps,
  markPassPaid,
  payBookingWithPassAsCustomer,
  publishEvent,
  sellPass,
  setPassPlanArchived,
} from "@horaya/core";
import { eq } from "drizzle-orm";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import {
  findCustomerIdByEmail,
  getCustomerPassSummary,
  listCustomerPasses,
  listUsablePasses,
} from "../src/queries";
import { booking, customer, payment, tenantSettings } from "../src/schema";
import { createMember, createOrganization, db, fixedClock, testDeps } from "./helpers";

afterAll(() => db.$client.end());

let organizationId: string;
let owner: Actor;
let deps: Deps;
let clock: ReturnType<typeof fixedClock>;
let typeId: string;

beforeEach(async () => {
  organizationId = await createOrganization();
  owner = await createMember(organizationId);
  clock = fixedClock();
  deps = testDeps(clock);
  typeId = (await createEventType(deps, owner, { name: "Poterie", color: "#D8BC66" })).id;
});

async function session(day = 10, eventTypeId = typeId, month = "2026-11") {
  const [created] = await createEvent(deps, owner, {
    eventTypeId,
    title: `Poterie ${day}`,
    startsAt: `${month}-${day}T09:00:00Z`,
    endsAt: `${month}-${day}T11:00:00Z`,
    timezone: "Europe/Paris",
    capacity: 8,
    priceCents: 3500,
    paymentMode: "on_site",
  });
  if (!created) throw new Error("événement");
  return publishEvent(deps, owner, created.id);
}

async function newCustomer(email = "camille@mail.com") {
  const [created] = await db
    .insert(customer)
    .values({ organizationId, firstName: "Camille", lastName: "Roux", email })
    .returning();
  if (!created) throw new Error("client");
  return created;
}

async function activePass(sessions = 5, eventTypeIds: string[] = [], customerId?: string) {
  const plan = await createPassPlan(deps, owner, {
    name: `Carte ${sessions}`,
    sessions,
    priceCents: sessions * 3000,
    validityDays: 90,
    eventTypeIds,
  });
  const client = customerId ?? (await newCustomer()).id;
  const pass = await sellPass(deps, owner, { customerId: client, planId: plan.id, paid: true });
  return { pass, customerId: client };
}

const counter = (eventId: string, customerId: string, passId: string, seats = 1) =>
  createCounterBooking(deps, owner, { eventId, seats, customerId, passId });

const balanceOf = async (customerId: string, passId: string) =>
  (await listCustomerPasses(db, organizationId, customerId)).find((entry) => entry.id === passId)
    ?.balance;

describe("vente et activation", () => {
  it("une carte vendue non payée attend ; payée, elle est active avec solde et date de fin", async () => {
    const plan = await createPassPlan(deps, owner, {
      name: "Carte 10",
      sessions: 10,
      priceCents: 25000,
      validityDays: 180,
    });
    const client = await newCustomer();
    const pending = await sellPass(deps, owner, { customerId: client.id, planId: plan.id });
    expect(pending.status).toBe("pending");
    expect(await balanceOf(client.id, pending.id)).toBe(0);

    const paid = await markPassPaid(deps, owner, pending.id, "check");
    expect(paid).toMatchObject({ status: "active", paymentMethod: "check" });
    expect(paid.expiresAt?.toISOString()).toBe("2027-03-30T08:00:00.000Z");
    expect(await balanceOf(client.id, pending.id)).toBe(10);
    await expect(markPassPaid(deps, owner, pending.id)).rejects.toThrow(/déjà active/);
  });

  it("une formule archivée n'est plus vendable, mais les cartes vendues restent", async () => {
    const { pass, customerId } = await activePass(5);
    if (!pass.planId) throw new Error("formule");
    await setPassPlanArchived(deps, owner, pass.planId, true);
    await expect(sellPass(deps, owner, { customerId, planId: pass.planId })).rejects.toThrow(
      /introuvable/,
    );
    expect(await balanceOf(customerId, pass.id)).toBe(5);
  });
});

describe("utilisation au comptoir", () => {
  it("débite une séance par place sans encaisser d'argent", async () => {
    const event = await session();
    const { pass, customerId } = await activePass(5);
    const { booking: created } = await counter(event.id, customerId, pass.id, 2);

    expect(created.paymentStatus).toBe("paid_with_pass");
    expect(await balanceOf(customerId, pass.id)).toBe(3);
    expect(await db.select().from(payment).where(eq(payment.bookingId, created.id))).toHaveLength(
      0,
    );
    const [entry] = await listCustomerPasses(db, organizationId, customerId);
    expect(entry?.movements.map((movement) => [movement.kind, movement.delta])).toEqual([
      ["use", -2],
      ["purchase", 5],
    ]);
  });

  it("refuse quand le solde ne suffit pas, sans rien écrire", async () => {
    const event = await session();
    const { pass, customerId } = await activePass(1);
    await expect(counter(event.id, customerId, pass.id, 2)).rejects.toThrow(/Solde insuffisant/);
    expect(await balanceOf(customerId, pass.id)).toBe(1);
    expect(await db.select().from(booking).where(eq(booking.customerId, customerId))).toHaveLength(
      0,
    );
  });

  it("refuse une carte expirée, d'un autre client ou d'un autre type d'événement", async () => {
    const other = (await createEventType(deps, owner, { name: "Peinture", color: "#528D74" })).id;
    const event = await session();
    const otherEvent = await session(11, other);
    const { pass, customerId } = await activePass(5, [typeId]);

    await expect(counter(otherEvent.id, customerId, pass.id)).rejects.toThrow(/type d'événement/);
    const stranger = await newCustomer("autre@mail.com");
    await expect(counter(event.id, stranger.id, pass.id)).rejects.toThrow(/introuvable/);

    const later = await session(10, typeId, "2027-02");
    clock.set(new Date("2027-01-15T08:00:00Z"));
    await expect(counter(later.id, customerId, pass.id)).rejects.toThrow(/expiré/);
    expect(await listUsablePasses(db, organizationId, customerId, typeId, clock.now())).toEqual([]);
  });
});

describe("concurrence", () => {
  it("deux réservations simultanées ne consomment pas la même dernière séance", async () => {
    const [a, b] = [await session(10), await session(11)];
    const { pass, customerId } = await activePass(1);
    const results = await Promise.allSettled([
      counter(a.id, customerId, pass.id),
      counter(b.id, customerId, pass.id),
    ]);
    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    expect(await balanceOf(customerId, pass.id)).toBe(0);
  });

  it("une même réservation ne se règle pas deux fois avec la carte", async () => {
    const event = await session();
    const { pass, customerId } = await activePass(5);
    const { booking: created } = await createCounterBooking(deps, owner, {
      eventId: event.id,
      seats: 1,
      customerId,
    });
    const identity = { organizationId, customerId };
    const results = await Promise.allSettled([
      payBookingWithPassAsCustomer(deps, identity, { bookingId: created.id, passId: pass.id }),
      payBookingWithPassAsCustomer(deps, identity, { bookingId: created.id, passId: pass.id }),
    ]);
    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    expect(await balanceOf(customerId, pass.id)).toBe(4);
  });

  it("refuse la carte sur une réservation déjà en partie payée (bon cadeau)", async () => {
    const event = await session();
    const { pass, customerId } = await activePass(5);
    const { booking: created } = await createCounterBooking(deps, owner, {
      eventId: event.id,
      seats: 1,
      customerId,
    });
    await db.insert(payment).values({
      organizationId,
      bookingId: created.id,
      kind: "charge",
      status: "succeeded",
      amountCents: 1000,
      provider: "gift_card",
      method: "gift_card",
    });
    await expect(
      payBookingWithPassAsCustomer(
        deps,
        { organizationId, customerId },
        { bookingId: created.id, passId: pass.id },
      ),
    ).rejects.toThrow(/en partie payée/);
    expect(await balanceOf(customerId, pass.id)).toBe(5);
  });

  it("retrouve la fiche du client connecté par l'e-mail de son compte, dans cet espace seulement", async () => {
    const mine = await newCustomer("Lea@Mail.com");
    expect(await findCustomerIdByEmail(db, organizationId, "lea@mail.com")).toBe(mine.id);
    const other = await createOrganization();
    expect(await findCustomerIdByEmail(db, other, "lea@mail.com")).toBeNull();
  });

  it("un client ne règle que ses propres réservations", async () => {
    const event = await session();
    const { pass, customerId } = await activePass(5);
    const stranger = await newCustomer("autre@mail.com");
    const { booking: created } = await createCounterBooking(deps, owner, {
      eventId: event.id,
      seats: 1,
      customerId: stranger.id,
    });
    await expect(
      payBookingWithPassAsCustomer(
        deps,
        { organizationId, customerId },
        { bookingId: created.id, passId: pass.id },
      ),
    ).rejects.toThrow(/introuvable/);
  });
});

describe("annulation et recrédit", () => {
  const policy = (hours: number) =>
    db
      .update(tenantSettings)
      .set({ freeCancellationHours: hours })
      .where(eq(tenantSettings.organizationId, organizationId));

  it("le client annulant dans le délai récupère ses séances, une seule fois", async () => {
    await policy(24);
    const event = await session();
    const { pass, customerId } = await activePass(5);
    const { booking: created, manageToken } = await counter(event.id, customerId, pass.id, 2);

    await cancelBookingWithToken(deps, organizationId, manageToken);
    expect(await balanceOf(customerId, pass.id)).toBe(5);
    const [row] = await db.select().from(booking).where(eq(booking.id, created.id));
    expect(row?.paymentStatus).toBe("none");
  });

  it("le client annulant hors délai perd la séance", async () => {
    await policy(24);
    const event = await session();
    const { pass, customerId } = await activePass(5);
    const { manageToken } = await counter(event.id, customerId, pass.id);
    clock.set(new Date("2026-11-09T20:00:00Z")); // 13 h avant

    await cancelBookingWithToken(deps, organizationId, manageToken);
    expect(await balanceOf(customerId, pass.id)).toBe(4);
  });

  it("une réservation annulée par l'équipe : recrédit par défaut dans le délai, pas après", async () => {
    await policy(24);
    const event = await session();
    const { pass, customerId } = await activePass(5);
    const early = await counter(event.id, customerId, pass.id);
    await cancelBooking(deps, owner, early.booking.id);
    expect(await balanceOf(customerId, pass.id)).toBe(5);

    const late = await counter(event.id, customerId, pass.id);
    clock.set(new Date("2026-11-10T08:00:00Z")); // 1 h avant
    await cancelBooking(deps, owner, late.booking.id);
    expect(await balanceOf(customerId, pass.id)).toBe(4);
  });

  it("l'équipe tranche : case cochée tard, décochée dans le délai", async () => {
    await policy(24);
    const event = await session();
    const { pass, customerId } = await activePass(5);
    const early = await counter(event.id, customerId, pass.id);
    await cancelBooking(deps, owner, early.booking.id, undefined, false);
    expect(await balanceOf(customerId, pass.id)).toBe(4);

    const late = await counter(event.id, customerId, pass.id);
    clock.set(new Date("2026-11-10T08:00:00Z"));
    await cancelBooking(deps, owner, late.booking.id, undefined, true);
    expect(await balanceOf(customerId, pass.id)).toBe(4);
  });

  it("l'atelier qui annule l'événement entier recrédite toujours, même tard et sans délai gratuit", async () => {
    await policy(0);
    const event = await session();
    const { pass, customerId } = await activePass(5);
    await counter(event.id, customerId, pass.id, 2);
    clock.set(new Date("2026-11-10T08:00:00Z"));

    await cancelEvent(deps, owner, event.id);
    expect(await balanceOf(customerId, pass.id)).toBe(5);
  });
});

describe("validité à la date de la séance", () => {
  // Carte activée le 2026-10-01, 90 jours : valable jusqu'au 2026-12-30.
  it("refuse une séance après la fin de validité, même si la carte est encore valable aujourd'hui", async () => {
    const before = await session(10, typeId, "2026-12");
    const after = await session(10, typeId, "2027-01");
    const { pass, customerId } = await activePass(5);

    await expect(counter(after.id, customerId, pass.id)).rejects.toThrow(
      /plus valable à la date de cette séance/,
    );
    expect(await balanceOf(customerId, pass.id)).toBe(5);
    await counter(before.id, customerId, pass.id);
    expect(await balanceOf(customerId, pass.id)).toBe(4);
  });

  it("ne propose la carte que pour les séances avant sa fin de validité", async () => {
    const { customerId } = await activePass(5);
    const list = (startsAt?: string) =>
      listUsablePasses(
        db,
        organizationId,
        customerId,
        typeId,
        clock.now(),
        startsAt ? new Date(startsAt) : undefined,
      );
    expect(await list("2026-12-10T09:00:00Z")).toHaveLength(1);
    expect(await list("2027-01-10T09:00:00Z")).toHaveLength(0);
    expect(await list()).toHaveLength(1);
  });
});

describe("ajustement manuel", () => {
  it("s'ajoute au journal avec son motif et ne descend jamais sous zéro", async () => {
    const { pass, customerId } = await activePass(2);
    await adjustPass(deps, owner, pass.id, { delta: 1, reason: "Geste commercial" });
    expect(await balanceOf(customerId, pass.id)).toBe(3);
    await expect(adjustPass(deps, owner, pass.id, { delta: -4, reason: "Erreur" })).rejects.toThrow(
      /négatif/,
    );
    await expect(adjustPass(deps, owner, pass.id, { delta: 1, reason: "" })).rejects.toThrow();
    const [entry] = await listCustomerPasses(db, organizationId, customerId);
    expect(entry?.movements[0]).toMatchObject({ kind: "adjustment", reason: "Geste commercial" });
  });

  it("alimente le bloc de l'espace client", async () => {
    const { pass, customerId } = await activePass(10);
    const event = await session();
    await counter(event.id, customerId, pass.id, 3);
    expect(await getCustomerPassSummary(db, organizationId, customerId, clock.now())).toEqual([
      expect.objectContaining({ remaining: 7, total: 10 }),
    ]);
  });
});
