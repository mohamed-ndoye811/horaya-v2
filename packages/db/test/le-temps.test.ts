import {
  type Actor,
  ConflictError,
  cancelEvent,
  cancelStage,
  cancelStageEnrollmentWithToken,
  createCounterBooking,
  createEvent,
  createEventBooking,
  createEventType,
  createItem,
  type Deps,
  type EventModules,
  enrollInSeries,
  findSlots,
  holdSlot,
  publishEvent,
  type SlotsModule,
} from "@horaya/core";
import { and, asc, eq, isNull } from "drizzle-orm";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import {
  activityLog,
  booking,
  eventSeries,
  event as eventTable,
  itemAllocation,
  itemUnit,
  seriesEnrollment,
  slotHold,
} from "../src/schema";
import { repositoriesFor } from "../src/unit-of-work";
import {
  contact,
  createMember,
  createOrganization,
  customerActor,
  db,
  fixedClock,
  testDeps,
} from "./helpers";

afterAll(() => db.$client.end());

let organizationId: string;
let owner: Actor;
let camille: Actor;
let clock: ReturnType<typeof fixedClock>;
let deps: Deps;

beforeEach(async () => {
  organizationId = await createOrganization();
  owner = await createMember(organizationId);
  camille = await createMember(organizationId, "editor");
  clock = fixedClock();
  deps = testDeps(clock);
});

const memberId = (actor: Actor) => (actor.type === "member" ? actor.memberId : "");
const closed: SlotsModule["weekly"] = [[], [], [], [], [], [], []];
/** Mardi 14:00–18:00. */
const slots = (extra: Partial<SlotsModule> = {}): SlotsModule => ({
  weekly: closed.map((ranges, day) => (day === 1 ? [{ start: "14:00", end: "18:00" }] : ranges)),
  intervalMinutes: 30,
  breakMinutes: 15,
  ...extra,
});
const durations: EventModules["duration"] = {
  options: [
    { id: "1h", label: "1 h", minutes: 60, priceCents: 4500 },
    { id: "2h", label: "2 h", minutes: 120, priceCents: 8000 },
  ],
  defaultId: "1h",
};
// Mardi 10 novembre 2026, 14:00 à Paris.
const AT_14 = new Date("2026-11-10T13:00:00Z");

async function slotType(modules: EventModules) {
  return createEventType(deps, owner, {
    name: `Cours particulier ${Math.random().toString(36).slice(2, 7)}`,
    color: "#CF879C",
    modules,
  });
}

const counter = (eventTypeId: string, startsAt: Date, extra: Record<string, unknown> = {}) =>
  createCounterBooking(deps, owner, {
    slot: { eventTypeId, startsAt, ...extra },
    seats: 1,
    customer: { firstName: "Léa", lastName: "Martin", phone: "0600000000" },
  });

const slotsOn = async (eventTypeId: string, durationId?: string) =>
  db.transaction(async (tx) => {
    const repositories = repositoriesFor(tx);
    const eventType = await repositories.eventTypes.find(organizationId, eventTypeId);
    if (!eventType) throw new Error("type");
    return findSlots(repositories, organizationId, eventType, {
      from: { year: 2026, month: 11, day: 10 },
      days: 1,
      now: clock.now(),
      timeZone: "Europe/Paris",
      durationId,
    });
  });

describe("créneaux", () => {
  it("réserver un créneau crée son événement, à la durée et au prix choisis", async () => {
    const type = await slotType({ slots: slots(), duration: durations });
    const hold = await holdSlot(deps, customerActor(organizationId), {
      eventTypeId: type.id,
      startsAt: AT_14,
      durationId: "2h",
    });
    expect(hold.endsAt.toISOString()).toBe("2026-11-10T15:00:00.000Z");
    const { booking: created } = await createEventBooking(deps, customerActor(organizationId), {
      holdId: hold.id,
      seats: 1,
      customer: contact(),
    });
    expect(created.amountCents).toBe(8000);
    expect(created.priceLines[0]).toMatchObject({ kind: "duration", id: "2h" });
    const [event] = await db
      .select()
      .from(eventTable)
      .where(eq(eventTable.id, created.eventId ?? ""));
    expect(event).toMatchObject({ fromSlot: true, status: "published", capacity: 1 });
    expect(event?.modules.duration?.options.map((option) => option.id)).toEqual(["2h"]);
    expect(await db.select().from(slotHold).where(eq(slotHold.id, hold.id))).toHaveLength(0);
    // 14:00–16:00 et sa pause : le prochain départ d'une heure est à 16:15.
    expect((await slotsOn(type.id)).map((slot) => slot.startsAt.toISOString())[0]).toBe(
      "2026-11-10T15:15:00.000Z",
    );
  });

  it("deux réservations simultanées du même créneau : une seule passe", async () => {
    const type = await slotType({ slots: slots() });
    const results = await Promise.allSettled([
      counter(type.id, AT_14),
      counter(type.id, AT_14),
      counter(type.id, AT_14),
    ]);
    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    for (const result of results.filter((entry) => entry.status === "rejected")) {
      expect((result as PromiseRejectedResult).reason).toBeInstanceOf(ConflictError);
    }
    const events = await db
      .select()
      .from(eventTable)
      .where(and(eq(eventTable.eventTypeId, type.id), eq(eventTable.fromSlot, true)));
    expect(events).toHaveLength(1);
  });

  it("deux intervenants : deux élèves en même temps, jamais un troisième", async () => {
    const type = await slotType({
      slots: slots({ memberIds: [memberId(owner), memberId(camille)], chooseStaff: true }),
    });
    const results = await Promise.allSettled([
      counter(type.id, AT_14),
      counter(type.id, AT_14),
      counter(type.id, AT_14),
    ]);
    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(2);
    const staff = (
      await db
        .select({ staff: eventTable.staffMemberId })
        .from(eventTable)
        .where(eq(eventTable.eventTypeId, type.id))
    ).map((row) => row.staff);
    expect(new Set(staff)).toEqual(new Set([memberId(owner), memberId(camille)]));
    // L'élève qui choisit Camille sur un créneau où elle est prise est refusé.
    await expect(
      counter(type.id, new Date("2026-11-10T13:30:00Z"), { staffMemberId: memberId(camille) }),
    ).rejects.toThrow(ConflictError);
  });

  it("la base refuse deux créneaux qui se chevauchent pour le même intervenant", async () => {
    const type = await slotType({ slots: slots({ memberIds: [memberId(camille)] }) });
    await counter(type.id, AT_14);
    const [existing] = await db
      .select()
      .from(eventTable)
      .where(eq(eventTable.eventTypeId, type.id));
    if (!existing) throw new Error("créneau");
    const { id: _id, createdAt: _c, updatedAt: _u, ...copy } = existing;
    await expect(
      db.insert(eventTable).values({ ...copy, slug: `${copy.slug}-bis` }),
    ).rejects.toThrow();
  });

  it("un créneau gardé 10 minutes disparaît pour les autres, puis revient", async () => {
    const type = await slotType({ slots: slots() });
    const lea = await holdSlot(deps, customerActor(organizationId), {
      eventTypeId: type.id,
      startsAt: AT_14,
    });
    await expect(
      holdSlot(deps, customerActor(organizationId), { eventTypeId: type.id, startsAt: AT_14 }),
    ).rejects.toThrow(ConflictError);
    expect(
      (await slotsOn(type.id)).some((slot) => slot.startsAt.getTime() === AT_14.getTime()),
    ).toBe(false);

    // 11 minutes plus tard : expiré, le créneau est de nouveau libre…
    clock.set(new Date(clock.now().getTime() + 11 * 60_000));
    const tom = await holdSlot(deps, customerActor(organizationId), {
      eventTypeId: type.id,
      startsAt: AT_14,
    });
    // … et l'élève qui l'avait gardé ne peut plus le prendre, puisqu'un autre le garde.
    await expect(
      createEventBooking(deps, customerActor(organizationId), {
        holdId: lea.id,
        seats: 1,
        customer: contact(),
      }),
    ).rejects.toThrow(ConflictError);
    // Le nettoyage a supprimé la réservation provisoire expirée.
    expect(await db.select().from(slotHold).where(eq(slotHold.id, lea.id))).toHaveLength(0);
    const booked = await createEventBooking(deps, customerActor(organizationId), {
      holdId: tom.id,
      seats: 1,
      customer: contact("tom@mail.fr"),
    });
    expect(booked.booking.status).toBe("confirmed");
  });

  it("un créneau gardé expiré mais encore libre se réserve quand même", async () => {
    const type = await slotType({ slots: slots() });
    const hold = await holdSlot(deps, customerActor(organizationId), {
      eventTypeId: type.id,
      startsAt: AT_14,
    });
    clock.set(new Date(clock.now().getTime() + 30 * 60_000));
    await expect(
      createEventBooking(deps, customerActor(organizationId), {
        holdId: hold.id,
        seats: 1,
        customer: contact(),
      }),
    ).resolves.toBeDefined();
  });

  it("le matériel obligatoire limite les créneaux en parallèle", async () => {
    const tours = await createItem(deps, owner, { name: "Tour", typeName: "Tours", quantity: 1 });
    const type = await slotType({
      slots: slots({ memberIds: [memberId(owner), memberId(camille)] }),
      equipment: {
        needs: [
          {
            id: "tour",
            itemTypeId: tours.itemTypeId as string,
            perSeat: 1,
            required: true,
            chooser: "workshop",
          },
        ],
      },
    });
    await counter(type.id, AT_14);
    // Camille est libre, mais le seul tour est pris : plus de créneau qui chevauche 14:00–15:00.
    const free = (await slotsOn(type.id)).map((slot) => slot.startsAt.toISOString());
    expect(free[0]).toBe("2026-11-10T14:00:00.000Z");
    await expect(counter(type.id, new Date("2026-11-10T13:30:00Z"))).rejects.toThrow(ConflictError);
  });

  it("créneau à plusieurs places : le second élève rejoint le même événement", async () => {
    const type = await slotType({ slots: slots({ seatsPerSlot: 2 }) });
    const first = await counter(type.id, AT_14);
    const second = await counter(type.id, AT_14);
    expect(second.booking.eventId).toBe(first.booking.eventId);
    await expect(counter(type.id, AT_14)).rejects.toThrow(ConflictError);
  });
});

/* ---------- Plusieurs séances (stage) ---------- */

const SESSIONS = [
  { startsAt: "2026-11-14T09:00:00Z", endsAt: "2026-11-14T16:00:00Z", topic: "Centrage" },
  { startsAt: "2026-11-21T09:00:00Z", endsAt: "2026-11-21T16:00:00Z", topic: "Tournassage" },
  { startsAt: "2026-12-05T09:00:00Z", endsAt: "2026-12-05T12:00:00Z", topic: "Émaillage" },
];

async function stage(modules: EventModules = {}, extra: Record<string, unknown> = {}) {
  const type = await createEventType(deps, owner, {
    name: `Stage ${Math.random().toString(36).slice(2, 7)}`,
    color: "#528D74",
    modules: {
      sessions: {},
      places: { capacity: 8 },
      cancellation: { freeHours: 168, lateRefundPercent: 50 },
      pricing: {
        rates: [
          { id: "plein", name: "Plein", priceCents: 25000 },
          { id: "reduit", name: "Réduit", priceCents: 21000 },
        ],
      },
      ...modules,
    },
  });
  const created = await createEvent(deps, owner, {
    eventTypeId: type.id,
    title: "Stage tour : de la motte au bol",
    startsAt: SESSIONS[0]?.startsAt,
    endsAt: SESSIONS[0]?.endsAt,
    timezone: "Europe/Paris",
    capacity: 8,
    paymentMode: "on_site",
    prices: { plein: 24000, reduit: 20000 },
    sessions: SESSIONS,
    ...extra,
  });
  const sessions = [];
  for (const event of created) sessions.push(await publishEvent(deps, owner, event.id));
  return { sessions, seriesId: sessions[0]?.seriesId ?? "" };
}

const enroll = (seriesId: string, email = "lea@mail.fr", rateId?: string) =>
  enrollInSeries(deps, customerActor(organizationId), {
    seriesId,
    customer: { ...contact(email), phone: null },
    rateId,
  });

describe("plusieurs séances (stage)", () => {
  it("un stage : trois séances, une série, un prix pour tout le stage", async () => {
    const { sessions, seriesId } = await stage();
    expect(sessions.map((session) => session.sessionTopic)).toEqual([
      "Centrage",
      "Tournassage",
      "Émaillage",
    ]);
    expect(sessions[2]?.endsAt.toISOString()).toBe("2026-12-05T12:00:00.000Z");
    // Chaque séance vaut sa part, à l'euro (240 € / 3).
    expect(sessions[0]?.modules.pricing?.rates.map((rate) => rate.priceCents)).toEqual([
      8000, 6700,
    ]);
    const [series] = await db.select().from(eventSeries).where(eq(eventSeries.id, seriesId));
    expect(series).toMatchObject({
      kind: "stage",
      enrollmentEnabled: true,
      enrollmentPriceCents: 24000,
      enrollmentPrices: { plein: 24000, reduit: 20000 },
      dropInAllowed: false,
    });

    const { enrollment, bookings } = await enroll(seriesId, "lea@mail.fr", "reduit");
    expect(enrollment.amountCents).toBe(20000);
    expect(enrollment.priceLines).toEqual([
      {
        kind: "rate",
        id: "reduit",
        label: "Réduit",
        unitCents: 20000,
        quantity: 1,
        totalCents: 20000,
      },
    ]);
    expect(bookings.map((entry) => entry.eventId)).toEqual(sessions.map((session) => session.id));
    // À l'unité, c'est fermé.
    await expect(
      createEventBooking(deps, customerActor(organizationId), {
        eventId: sessions[1]?.id,
        seats: 1,
        customer: contact("autre@mail.fr"),
      }),
    ).rejects.toThrow(ConflictError);
  });

  it("« même tour à chaque séance » : le même exemplaire réservé sur toutes les séances", async () => {
    const tours = await createItem(deps, owner, { name: "Tour", typeName: "Tours", quantity: 2 });
    const units = (
      await db
        .select({ id: itemUnit.id })
        .from(itemUnit)
        .where(eq(itemUnit.itemId, tours.id))
        .orderBy(asc(itemUnit.label))
    ).map((row) => row.id);
    const { sessions, seriesId } = await stage(
      {
        equipment: {
          needs: [
            {
              id: "tour",
              itemTypeId: tours.itemTypeId as string,
              perSeat: 1,
              required: true,
              chooser: "workshop",
            },
          ],
        },
      },
      { sameEquipment: true },
    );
    // Le premier tour est en maintenance pendant la deuxième séance : seul le second convient partout.
    await db.insert(itemAllocation).values({
      organizationId,
      itemUnitId: units[0] as string,
      kind: "maintenance",
      startsAt: new Date("2026-11-21T08:00:00Z"),
      endsAt: new Date("2026-11-21T18:00:00Z"),
    });
    const { bookings } = await enroll(seriesId);
    const held = await db
      .select({ unit: itemAllocation.itemUnitId, eventId: itemAllocation.eventId })
      .from(itemAllocation)
      .where(
        and(
          eq(itemAllocation.organizationId, organizationId),
          eq(itemAllocation.kind, "event"),
          isNull(itemAllocation.cancelledAt),
        ),
      );
    expect(held).toHaveLength(3);
    expect(new Set(held.map((entry) => entry.unit))).toEqual(new Set([units[1]]));
    expect(new Set(held.map((entry) => entry.eventId))).toEqual(
      new Set(sessions.map((session) => session.id)),
    );
    // Plus aucun tour libre sur toutes les séances : la seconde inscription est refusée, sans trace.
    await expect(enroll(seriesId, "tom@mail.fr")).rejects.toThrow(ConflictError);
    expect(bookings).toHaveLength(3);
  });

  it("annuler une séance prévient ses inscrits, l'inscription au stage reste", async () => {
    const { sessions, seriesId } = await stage();
    const { enrollment } = await enroll(seriesId);
    await cancelEvent(deps, owner, sessions[1]?.id ?? "");
    const rows = await db
      .select({ eventId: booking.eventId, status: booking.status })
      .from(booking)
      .where(eq(booking.enrollmentId, enrollment.id));
    expect(rows.find((row) => row.eventId === sessions[1]?.id)?.status).toBe("cancelled");
    expect(rows.filter((row) => row.status === "confirmed")).toHaveLength(2);
    const [kept] = await db
      .select()
      .from(seriesEnrollment)
      .where(eq(seriesEnrollment.id, enrollment.id));
    expect(kept?.cancelledAt).toBeNull();
    const logged = await db
      .select({ data: activityLog.data })
      .from(activityLog)
      .where(
        and(
          eq(activityLog.action, "booking.cancelled"),
          eq(activityLog.organizationId, organizationId),
        ),
      );
    expect(logged.map((entry) => (entry.data as { reason: string }).reason)).toEqual([
      "event_cancelled",
    ]);
  });

  it("annuler le stage annule toutes ses séances et les inscriptions, un seul message", async () => {
    const { sessions, seriesId } = await stage();
    const { enrollment } = await enroll(seriesId);
    const result = await cancelStage(deps, owner, seriesId);
    expect(result).toEqual({ cancelledSessions: 3, cancelledEnrollments: 1 });
    const statuses = await db
      .select({ status: eventTable.status })
      .from(eventTable)
      .where(eq(eventTable.seriesId, seriesId));
    expect(statuses.every((row) => row.status === "cancelled")).toBe(true);
    const [cancelled] = await db
      .select()
      .from(seriesEnrollment)
      .where(eq(seriesEnrollment.id, enrollment.id));
    expect(cancelled?.cancelledAt).not.toBeNull();
    const reasons = (
      await db
        .select({ action: activityLog.action, data: activityLog.data })
        .from(activityLog)
        .where(eq(activityLog.organizationId, organizationId))
    ).filter(
      (entry) => entry.action === "booking.cancelled" || entry.action === "enrollment.cancelled",
    );
    expect(reasons.map((entry) => (entry.data as { reason: string }).reason)).toEqual([
      ...sessions.map(() => "stage_cancelled"),
      "stage_cancelled",
    ]);
  });

  it("l'élève annule son stage : toutes ses séances, remboursé selon la règle du type", async () => {
    const { seriesId } = await stage();
    const early = await enroll(seriesId, "lea@mail.fr");
    const late = await enroll(seriesId, "tom@mail.fr");
    const first = await cancelStageEnrollmentWithToken(deps, organizationId, early.manageToken);
    expect(first.refundPercent).toBe(100);
    const active = await db
      .select()
      .from(booking)
      .where(and(eq(booking.enrollmentId, early.enrollment.id), eq(booking.status, "confirmed")));
    expect(active).toHaveLength(0);
    // Moins de 7 jours avant la première séance : la moitié.
    clock.set(new Date("2026-11-10T08:00:00Z"));
    const second = await cancelStageEnrollmentWithToken(deps, organizationId, late.manageToken);
    expect(second.refundPercent).toBe(50);
    await expect(
      cancelStageEnrollmentWithToken(deps, organizationId, late.manageToken),
    ).rejects.toThrow(ConflictError);
  });

  it("plus d'inscription une fois le stage commencé", async () => {
    const { seriesId } = await stage();
    clock.set(new Date("2026-11-15T08:00:00Z"));
    await expect(enroll(seriesId)).rejects.toThrow("Le stage a commencé");
  });
});
