import {
  type Actor,
  ConflictError,
  cancelEnrollment,
  createEvent,
  createEventBooking,
  createEventType,
  type Deps,
  enrollInSeries,
  enrollmentProgress,
  publishEvent,
  reportAbsenceWithToken,
  updateSeriesEnrollment,
} from "@horaya/core";
import { and, asc, eq } from "drizzle-orm";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { getEnrollment, getSeriesOffer, listSeriesEnrollments } from "../src/queries";
import { booking, seriesEnrollment } from "../src/schema";
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
});

/** Tournage du mardi : 4 séances hebdomadaires, publiées, inscription au trimestre ouverte. */
async function weeklyCourse({
  capacity = 2,
  waitlist = false,
  dropInAllowed = true,
}: { capacity?: number; waitlist?: boolean; dropInAllowed?: boolean } = {}) {
  const type = await createEventType(deps, owner, {
    name: `Tournage ${Math.random().toString(36).slice(2, 7)}`,
    color: "#B4532A",
    bookingRules: { waitlistEnabled: waitlist },
  });
  const created = await createEvent(deps, owner, {
    eventTypeId: type.id,
    title: "Tournage du mardi",
    startsAt: "2026-11-03T17:30:00Z",
    endsAt: "2026-11-03T19:30:00Z",
    timezone: "Europe/Paris",
    capacity,
    priceCents: 3000,
    paymentMode: "on_site",
    recurrence: { frequency: "weekly", count: 4 },
  });
  const sessions = [];
  for (const event of created) sessions.push(await publishEvent(deps, owner, event.id));
  const seriesId = sessions[0]?.seriesId ?? "";
  await updateSeriesEnrollment(deps, owner, seriesId, {
    enrollmentEnabled: true,
    enrollmentPriceCents: 10000,
    dropInAllowed,
  });
  return { seriesId, sessions };
}

const enroll = (seriesId: string, email = "lea@mail.fr") =>
  enrollInSeries(deps, customerActor(organizationId), {
    seriesId,
    customer: { ...contact(email), phone: null },
  });

const activeSeats = async (eventId: string) =>
  (
    await db
      .select()
      .from(booking)
      .where(and(eq(booking.eventId, eventId), eq(booking.status, "confirmed")))
  ).length;

describe("inscription à une série", () => {
  it("prend une place dans chaque séance restante, pour un seul paiement", async () => {
    const { seriesId, sessions } = await weeklyCourse();
    // La première séance est passée : l'inscription porte sur les 3 suivantes.
    clock.set(new Date("2026-11-05T08:00:00Z"));
    const { enrollment, bookings, manageToken } = await enroll(seriesId);

    expect(enrollment).toMatchObject({ amountCents: 10000, paidAt: null, source: "public_page" });
    expect(bookings.map((entry) => entry.eventId)).toEqual(
      sessions.slice(1).map((event) => event.id),
    );
    for (const entry of bookings) {
      expect(entry).toMatchObject({
        status: "confirmed",
        amountCents: 0,
        enrollmentId: enrollment.id,
      });
    }
    expect(await activeSeats(sessions[0]?.id ?? "")).toBe(0);
    expect(manageToken).toHaveLength(43);

    const offer = await getSeriesOffer(db, organizationId, seriesId, clock.now());
    expect(offer?.sessions.map((session) => session.seatsHeld)).toEqual([1, 1, 1]);
  });

  it("refuse tout s'il manque une place sur une séance, en la nommant", async () => {
    const { seriesId, sessions } = await weeklyCourse({ capacity: 1 });
    await createEventBooking(deps, customerActor(organizationId), {
      eventId: sessions[2]?.id ?? "",
      seats: 1,
      customer: contact("autre@mail.fr"),
    });
    await expect(enroll(seriesId)).rejects.toThrow("Cette séance est complète : mar 17 nov");
    expect(
      await db.select().from(seriesEnrollment).where(eq(seriesEnrollment.seriesId, seriesId)),
    ).toHaveLength(0);
    expect(await activeSeats(sessions[0]?.id ?? "")).toBe(0);
  });

  it("ne réserve jamais deux fois la même personne", async () => {
    const { seriesId, sessions } = await weeklyCourse({ capacity: 5 });
    await enroll(seriesId);
    await expect(enroll(seriesId, "LEA@mail.fr")).rejects.toThrow("Déjà inscrit·e");

    const other = await weeklyCourse({ capacity: 5 });
    await createEventBooking(deps, customerActor(organizationId), {
      eventId: other.sessions[1]?.id ?? "",
      seats: 1,
      customer: contact("lea@mail.fr"),
    });
    await expect(enroll(other.seriesId)).rejects.toThrow("Déjà une réservation à la séance");
    expect(await activeSeats(sessions[0]?.id ?? "")).toBe(1);
  });

  it("ne vend pas la dernière place deux fois, même en simultané", async () => {
    const { seriesId, sessions } = await weeklyCourse({ capacity: 1 });
    const results = await Promise.allSettled(
      ["a@mail.fr", "b@mail.fr", "c@mail.fr"].map((email) => enroll(seriesId, email)),
    );
    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    for (const result of results) {
      if (result.status === "rejected") expect(result.reason).toBeInstanceOf(ConflictError);
    }
    for (const event of sessions) expect(await activeSeats(event.id)).toBe(1);
  });

  it("ferme la réservation à la séance quand l'organisateur le choisit", async () => {
    const { sessions } = await weeklyCourse({ dropInAllowed: false });
    await expect(
      createEventBooking(deps, customerActor(organizationId), {
        eventId: sessions[1]?.id ?? "",
        seats: 1,
        customer: contact(),
      }),
    ).rejects.toThrow("se réserve pour toute la série");
    // L'équipe garde la main (comptoir, réservation manuelle).
    await createEventBooking(deps, owner, {
      eventId: sessions[1]?.id ?? "",
      seats: 1,
      customer: contact(),
    });
  });

  it("exige un prix pour ouvrir l'inscription", async () => {
    const { seriesId } = await weeklyCourse();
    await expect(
      updateSeriesEnrollment(deps, owner, seriesId, {
        enrollmentEnabled: true,
        enrollmentPriceCents: null,
        dropInAllowed: true,
      }),
    ).rejects.toThrow();
  });
});

describe("absence et désinscription", () => {
  it("libère la place d'une séance pour la liste d'attente, l'inscription reste", async () => {
    const { seriesId, sessions } = await weeklyCourse({ capacity: 1, waitlist: true });
    const { enrollment, manageToken } = await enroll(seriesId);
    const target = sessions[2]?.id ?? "";
    const { booking: waiting } = await createEventBooking(deps, customerActor(organizationId), {
      eventId: target,
      seats: 1,
      customer: contact("attente@mail.fr"),
    });
    expect(waiting.status).toBe("waitlisted");

    const absent = await reportAbsenceWithToken(deps, organizationId, manageToken, target);
    expect(absent).toMatchObject({ status: "cancelled", absentAt: clock.now() });
    const [promoted] = await db.select().from(booking).where(eq(booking.id, waiting.id));
    expect(promoted?.status).toBe("confirmed");
    await expect(reportAbsenceWithToken(deps, organizationId, manageToken, target)).rejects.toThrow(
      "déjà signalée",
    );

    const detail = await getEnrollment(db, organizationId, { id: enrollment.id });
    expect(detail?.cancelledAt).toBeNull();
    const progress = enrollmentProgress(detail?.sessions ?? [], clock.now());
    expect(progress).toMatchObject({ total: 4, current: 1, absences: 1 });
    expect(
      (await listSeriesEnrollments(db, organizationId, seriesId, clock.now()))[0],
    ).toMatchObject({ sessions: 4, remaining: 3, absences: 1 });
  });

  it("refuse une absence une fois la séance commencée", async () => {
    const { seriesId, sessions } = await weeklyCourse();
    const { manageToken } = await enroll(seriesId);
    clock.set(new Date("2026-11-03T18:00:00Z"));
    await expect(
      reportAbsenceWithToken(deps, organizationId, manageToken, sessions[0]?.id ?? ""),
    ).rejects.toThrow("La séance a commencé");
  });

  it("désinscrit : libère les séances à venir, garde les passées", async () => {
    const { seriesId, sessions } = await weeklyCourse();
    const { enrollment } = await enroll(seriesId);
    clock.set(new Date("2026-11-12T08:00:00Z"));

    const { releasedSessions } = await cancelEnrollment(deps, owner, enrollment.id);
    expect(releasedSessions).toBe(2);
    const rows = await db
      .select({ status: booking.status, absentAt: booking.absentAt })
      .from(booking)
      .where(eq(booking.enrollmentId, enrollment.id))
      .orderBy(asc(booking.createdAt), asc(booking.id));
    expect(rows.map((row) => row.status)).toEqual([
      "confirmed",
      "confirmed",
      "cancelled",
      "cancelled",
    ]);
    expect(rows.every((row) => row.absentAt === null)).toBe(true);
    expect(await activeSeats(sessions[3]?.id ?? "")).toBe(0);
    await expect(cancelEnrollment(deps, owner, enrollment.id)).rejects.toThrow("déjà annulée");
    // On peut se réinscrire après une désinscription.
    await enroll(seriesId);
  });
});
