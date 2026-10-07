import {
  type Actor,
  archiveEventType,
  ConflictError,
  cancelBooking,
  cancelBookingWithToken,
  cancelEvent,
  confirmBooking,
  createEvent,
  createEventBooking,
  createEventType,
  type Deps,
  ForbiddenError,
  publishEvent,
  refuseBooking,
  updateEvent,
  updateEventType,
} from "@horaya/core";
import { and, asc, eq } from "drizzle-orm";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { activityLog, booking, customer, event as eventTable } from "../src/schema";
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
let deps: Deps;

beforeEach(async () => {
  organizationId = await createOrganization();
  owner = member(organizationId);
  deps = testDeps();
});

async function publishedEvent(
  options: {
    capacity?: number | null;
    waitlist?: boolean;
    requiresApproval?: boolean;
    visibility?: "public" | "invite_only";
    minAdvanceHours?: number;
  } = {},
) {
  const type = await createEventType(deps, owner, {
    name: `Séminaire ${Math.random().toString(36).slice(2, 7)}`,
    color: "#528D74",
    bookingRules: {
      waitlistEnabled: options.waitlist ?? false,
      minAdvanceHours: options.minAdvanceHours,
    },
  });
  const [created] = await createEvent(deps, owner, {
    eventTypeId: type.id,
    title: "Séminaire annuel",
    startsAt: "2026-11-10T09:00:00Z",
    endsAt: "2026-11-10T17:00:00Z",
    timezone: "Europe/Paris",
    capacity: options.capacity === undefined ? 5 : options.capacity,
    priceCents: 12000,
    paymentMode: "on_site",
    requiresApproval: options.requiresApproval ?? false,
    visibility: options.visibility ?? "public",
  });
  if (!created) throw new Error("Événement non créé");
  return publishEvent(deps, owner, created.id);
}

const book = (actor: Actor, eventId: string, seats = 1, email?: string) =>
  createEventBooking(deps, actor, { eventId, seats, customer: contact(email) });

describe("surréservation", () => {
  it("ne vend jamais plus de places qu'il n'y en a, même en rafale simultanée", async () => {
    const seminar = await publishedEvent({ capacity: 5 });

    const results = await Promise.allSettled(
      Array.from({ length: 12 }, (_, index) =>
        book(customerActor(organizationId), seminar.id, 1, `client${index}@mail.com`),
      ),
    );

    const accepted = results.filter((result) => result.status === "fulfilled");
    const rejected = results.filter((result) => result.status === "rejected");
    expect(accepted).toHaveLength(5);
    expect(rejected).toHaveLength(7);
    for (const result of rejected) expect(result.reason).toBeInstanceOf(ConflictError);

    const rows = await db.select().from(booking).where(eq(booking.eventId, seminar.id));
    expect(rows.reduce((total, row) => total + row.seats, 0)).toBe(5);
  });

  it("met en liste d'attente quand c'est complet et que la liste est ouverte", async () => {
    const seminar = await publishedEvent({ capacity: 2, waitlist: true });
    await book(customerActor(organizationId), seminar.id, 2, "a@mail.com");
    const { booking: late } = await book(
      customerActor(organizationId),
      seminar.id,
      1,
      "b@mail.com",
    );
    expect(late.status).toBe("waitlisted");
  });

  it("refuse une demande plus grande que les places restantes", async () => {
    const seminar = await publishedEvent({ capacity: 3 });
    await book(owner, seminar.id, 2, "a@mail.com");
    await expect(book(owner, seminar.id, 2, "b@mail.com")).rejects.toThrow(
      "Il ne reste que 1 place",
    );
  });
});

describe("liste d'attente", () => {
  it("fait monter la première demande qui tient quand une place se libère", async () => {
    const seminar = await publishedEvent({ capacity: 2, waitlist: true });
    const { booking: first } = await book(owner, seminar.id, 2, "a@mail.com");
    const { booking: tooBig } = await book(
      customerActor(organizationId),
      seminar.id,
      2,
      "b@mail.com",
    );
    const { booking: small } = await book(
      customerActor(organizationId),
      seminar.id,
      1,
      "c@mail.com",
    );
    expect([tooBig.status, small.status]).toEqual(["waitlisted", "waitlisted"]);

    // Une seule place se libère : la demande de 2 places est passée, celle d'une place monte.
    await updateEvent(deps, owner, seminar.id, { capacity: 3 });
    const statuses = await db
      .select({ id: booking.id, status: booking.status })
      .from(booking)
      .where(eq(booking.eventId, seminar.id));
    const statusOf = (id: string) => statuses.find((row) => row.id === id)?.status;
    expect(statusOf(first.id)).toBe("confirmed");
    expect(statusOf(tooBig.id)).toBe("waitlisted");
    expect(statusOf(small.id)).toBe("confirmed");

    // Annulation des 2 places : la grande demande passe enfin.
    await cancelBooking(deps, owner, first.id);
    const [promoted] = await db.select().from(booking).where(eq(booking.id, tooBig.id));
    expect(promoted?.status).toBe("confirmed");
  });

  it("repasse par la validation quand l'événement l'exige", async () => {
    const seminar = await publishedEvent({ capacity: 1, waitlist: true, requiresApproval: true });
    const { booking: first } = await book(
      customerActor(organizationId),
      seminar.id,
      1,
      "a@mail.com",
    );
    const { booking: second } = await book(
      customerActor(organizationId),
      seminar.id,
      1,
      "b@mail.com",
    );
    expect([first.status, second.status]).toEqual(["pending", "waitlisted"]);

    await refuseBooking(deps, owner, first.id, "Profil hors cible");
    const [promoted] = await db.select().from(booking).where(eq(booking.id, second.id));
    expect(promoted?.status).toBe("pending");
  });
});

describe("cycle de vie d'une réservation", () => {
  it("numérote les réservations par mois : VID-2610-0001, 0002…", async () => {
    const seminar = await publishedEvent({ capacity: null });
    const { booking: a } = await book(owner, seminar.id, 1, "a@mail.com");
    const { booking: b } = await book(owner, seminar.id, 1, "b@mail.com");
    expect([a.reference, b.reference]).toEqual(["VID-2610-0001", "VID-2610-0002"]);
  });

  it("calcule le montant et confirme directement une saisie de l'équipe", async () => {
    const seminar = await publishedEvent({ requiresApproval: true });
    const { booking: created } = await book(owner, seminar.id, 3);
    expect(created.status).toBe("confirmed");
    expect(created.amountCents).toBe(36000);
    expect(created.source).toBe("admin");
  });

  it("valide une demande en attente et garde la trace dans le journal", async () => {
    const seminar = await publishedEvent({ requiresApproval: true });
    const { booking: request } = await book(customerActor(organizationId), seminar.id);
    const confirmed = await confirmBooking(deps, owner, request.id);
    expect(confirmed.status).toBe("confirmed");
    expect(confirmed.confirmedAt).not.toBeNull();

    const actions = await db
      .select({ action: activityLog.action })
      .from(activityLog)
      .where(and(eq(activityLog.entityType, "booking"), eq(activityLog.entityId, request.id)))
      .orderBy(asc(activityLog.createdAt), asc(activityLog.id));
    expect(actions.map((row) => row.action)).toEqual(["booking.created", "booking.confirmed"]);
  });

  it("rattache les réservations au même client, quelle que soit la casse de l'e-mail", async () => {
    const seminar = await publishedEvent({ capacity: null });
    await book(owner, seminar.id, 1, "camille.roux@mail.com");
    await book(owner, seminar.id, 1, "Camille.Roux@MAIL.com");
    const customers = await db
      .select()
      .from(customer)
      .where(eq(customer.organizationId, organizationId));
    expect(customers).toHaveLength(1);
  });

  it("laisse le client annuler avec son lien, et refuse un faux lien", async () => {
    const seminar = await publishedEvent();
    const { booking: created, manageToken } = await book(customerActor(organizationId), seminar.id);
    await expect(cancelBookingWithToken(deps, organizationId, "faux-jeton")).rejects.toThrow(
      "Réservation introuvable",
    );
    const cancelled = await cancelBookingWithToken(deps, organizationId, manageToken);
    expect(cancelled.id).toBe(created.id);
    expect(cancelled.status).toBe("cancelled");
  });
});

describe("règles d'accès", () => {
  it("interdit au lecteur de réserver pour un client", async () => {
    const seminar = await publishedEvent();
    await expect(book(member(organizationId, "viewer"), seminar.id)).rejects.toBeInstanceOf(
      ForbiddenError,
    );
  });

  it("ferme la réservation en ligne sur un événement sur invitation", async () => {
    const seminar = await publishedEvent({ visibility: "invite_only" });
    await expect(book(customerActor(organizationId), seminar.id)).rejects.toBeInstanceOf(
      ForbiddenError,
    );
    // L'équipe peut toujours inscrire quelqu'un.
    await expect(book(owner, seminar.id)).resolves.toBeDefined();
  });

  it("clôt la réservation en ligne avant le délai minimum", async () => {
    const clock = fixedClock();
    deps = testDeps(clock);
    const seminar = await publishedEvent({ minAdvanceHours: 48 });
    clock.set(new Date("2026-11-09T10:00:00Z"));
    await expect(book(customerActor(organizationId), seminar.id)).rejects.toThrow(
      "Les réservations sont closes",
    );
  });

  it("cache les brouillons aux clients", async () => {
    const type = await createEventType(deps, owner, { name: "Atelier", color: "#D8BC66" });
    const [draft] = await createEvent(deps, owner, {
      eventTypeId: type.id,
      title: "Atelier prise de parole",
      startsAt: "2026-11-12T09:00:00Z",
      endsAt: "2026-11-12T12:00:00Z",
      timezone: "Europe/Paris",
    });
    await expect(book(customerActor(organizationId), draft?.id ?? "")).rejects.toThrow(
      "Événement introuvable",
    );
  });
});

describe("événements", () => {
  it("refuse de baisser la jauge sous les places occupées", async () => {
    const seminar = await publishedEvent({ capacity: 5 });
    await book(owner, seminar.id, 4);
    await expect(updateEvent(deps, owner, seminar.id, { capacity: 3 })).rejects.toThrow(
      "4 places sont déjà réservées",
    );
  });

  it("annule toutes les réservations actives avec l'événement", async () => {
    const seminar = await publishedEvent({ capacity: 1, waitlist: true });
    await book(owner, seminar.id, 1, "a@mail.com");
    await book(customerActor(organizationId), seminar.id, 1, "b@mail.com");

    const { cancelledBookings } = await cancelEvent(deps, owner, seminar.id, "Intervenant malade");
    expect(cancelledBookings).toBe(2);
    const statuses = await db
      .select({ status: booking.status })
      .from(booking)
      .where(eq(booking.eventId, seminar.id));
    expect(statuses.every((row) => row.status === "cancelled")).toBe(true);
    await expect(book(owner, seminar.id)).rejects.toThrow("Cet événement est annulé");
  });

  it("réserve l'annulation d'un événement aux administrateurs", async () => {
    const seminar = await publishedEvent();
    await expect(
      cancelEvent(deps, member(organizationId, "editor"), seminar.id),
    ).rejects.toBeInstanceOf(ForbiddenError);
  });

  it("crée une série : une occurrence = un événement avec sa propre adresse", async () => {
    const type = await createEventType(deps, owner, { name: "Atelier", color: "#D8BC66" });
    const occurrences = await createEvent(deps, owner, {
      eventTypeId: type.id,
      title: "Atelier prise de parole",
      startsAt: "2026-10-20T08:00:00Z",
      endsAt: "2026-10-20T10:00:00Z",
      timezone: "Europe/Paris",
      capacity: 12,
      recurrence: { frequency: "weekly", count: 3 },
    });
    expect(occurrences.map((occurrence) => occurrence.slug)).toEqual([
      "atelier-prise-de-parole-2026-10-20",
      "atelier-prise-de-parole-2026-10-27",
      "atelier-prise-de-parole-2026-11-03",
    ]);
    // 10 h à Paris de part et d'autre du passage à l'heure d'hiver (25 octobre).
    expect(occurrences.map((occurrence) => occurrence.startsAt.toISOString())).toEqual([
      "2026-10-20T08:00:00.000Z",
      "2026-10-27T09:00:00.000Z",
      "2026-11-03T09:00:00.000Z",
    ]);
    const seriesIds = new Set(occurrences.map((occurrence) => occurrence.seriesId));
    expect(seriesIds.size).toBe(1);
    expect([...seriesIds][0]).not.toBeNull();
  });

  it("donne une adresse distincte à deux événements du même nom", async () => {
    const first = await publishedEvent();
    const second = await publishedEvent();
    const slugs = await db
      .select({ slug: eventTable.slug })
      .from(eventTable)
      .where(eq(eventTable.organizationId, organizationId));
    expect(new Set(slugs.map((row) => row.slug)).size).toBe(2);
    expect([first.slug, second.slug]).toEqual(["seminaire-annuel", "seminaire-annuel-2"]);
  });

  it("modifie un type sans écraser ses champs non fournis", async () => {
    const type = await createEventType(deps, owner, {
      name: "Séminaire",
      color: "#528d74",
      customFields: [{ key: "entreprise", label: "Entreprise", type: "text", required: true }],
      bookingRules: { waitlistEnabled: true },
    });
    expect(type.color).toBe("#528D74");
    const updated = await updateEventType(deps, owner, type.id, { defaultPriceCents: 12000 });
    expect(updated.defaultPriceCents).toBe(12000);
    expect(updated.customFields).toHaveLength(1);
    expect(updated.bookingRules.waitlistEnabled).toBe(true);
  });

  it("n'utilise plus un type archivé pour créer des événements", async () => {
    const type = await createEventType(deps, owner, { name: "Ancien format", color: "#66537C" });
    await archiveEventType(deps, owner, type.id);
    await expect(
      createEvent(deps, owner, {
        eventTypeId: type.id,
        title: "Test",
        startsAt: "2026-11-12T09:00:00Z",
        endsAt: "2026-11-12T12:00:00Z",
        timezone: "Europe/Paris",
      }),
    ).rejects.toThrow("Type d'événement introuvable");
  });

  it("refuse deux types du même nom avec un message clair", async () => {
    await createEventType(deps, owner, { name: "Atelier", color: "#D8BC66" });
    await expect(
      createEventType(deps, owner, { name: "Atelier", color: "#528D74" }),
    ).rejects.toThrow("Un type d'événement porte déjà ce nom");
  });
});
