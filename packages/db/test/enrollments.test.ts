import {
  type Actor,
  assignMakeup,
  bookMakeupAsCustomer,
  ConflictError,
  cancelAbsenceAsCustomer,
  cancelAbsenceWithToken,
  cancelBookingAsCustomer,
  cancelEnrollment,
  createEvent,
  createEventBooking,
  createEventType,
  type Deps,
  type EventTypeField,
  enrollInSeries,
  enrollmentProgress,
  publishEvent,
  reportAbsenceAsCustomer,
  reportAbsenceWithToken,
  updateSeriesEnrollment,
} from "@horaya/core";
import { and, asc, eq } from "drizzle-orm";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import {
  getEnrollment,
  getSeriesOffer,
  listMakeupTargets,
  listSeriesEnrollments,
} from "../src/queries";
import { booking, bookingParticipant, seriesEnrollment } from "../src/schema";
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
  prorata = true,
  makeupAllowed = true,
  fields = [],
  eventTypeId,
}: {
  capacity?: number;
  waitlist?: boolean;
  dropInAllowed?: boolean;
  prorata?: boolean;
  makeupAllowed?: boolean;
  fields?: EventTypeField[];
  /** Même type d'événement qu'une autre série (rattrapage sur un autre créneau). */
  eventTypeId?: string;
} = {}) {
  const type = eventTypeId
    ? { id: eventTypeId }
    : await createEventType(deps, owner, {
        name: `Tournage ${Math.random().toString(36).slice(2, 7)}`,
        color: "#B4532A",
        modules: waitlist ? { waitlist: {} } : {},
        fields,
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
    enrollmentProrata: prorata,
    makeupAllowed,
  });
  return { seriesId, sessions, eventTypeId: type.id };
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

    // 3 séances restantes sur 4 : 100 € × 3 ÷ 4 = 75 €.
    expect(enrollment).toMatchObject({ amountCents: 7500, paidAt: null, source: "public_page" });
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

  it("plein tarif quand le prorata est désactivé", async () => {
    const { seriesId } = await weeklyCourse({ prorata: false });
    clock.set(new Date("2026-11-05T08:00:00Z"));
    expect((await enroll(seriesId)).enrollment.amountCents).toBe(10000);
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
        enrollmentProrata: true,
        makeupAllowed: true,
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

  it("depuis l'espace client : absence pour le titulaire seulement, ni annulation ni report", async () => {
    const { seriesId, sessions } = await weeklyCourse();
    const { bookings } = await enroll(seriesId);
    const session = bookings.find((entry) => entry.eventId === sessions[1]?.id);
    const id = session?.id ?? "";
    await expect(
      reportAbsenceAsCustomer(deps, organizationId, id, "autre@mail.fr"),
    ).rejects.toThrow("introuvable");
    await expect(cancelBookingAsCustomer(deps, organizationId, id, "lea@mail.fr")).rejects.toThrow(
      "signale plutôt ton absence",
    );
    const absent = await reportAbsenceAsCustomer(deps, organizationId, id, "LEA@mail.fr");
    expect(absent).toMatchObject({ status: "cancelled", absentAt: clock.now() });
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

describe("questions du type à l'inscription", () => {
  const FIELDS: EventTypeField[] = [
    { key: "deja", label: "Déjà tourné ?", type: "boolean", scope: "booking", required: true },
    {
      key: "depuis",
      label: "Depuis ?",
      type: "short_text",
      scope: "booking",
      required: true,
      condition: { fieldKey: "deja", equals: true },
    },
    { key: "age", label: "Âge", type: "number", scope: "participant", required: true },
  ];

  it("valide les réponses comme pour une séance, et les garde sur chaque séance", async () => {
    const { seriesId } = await weeklyCourse({ fields: FIELDS });
    const customer = { ...contact("lea@mail.fr"), phone: null };
    // Requises pour le client : refusées sans réponse, et rien n'est écrit.
    await expect(
      enrollInSeries(deps, customerActor(organizationId), { seriesId, customer }),
    ).rejects.toThrow("Vérifie les réponses");
    // Question conditionnelle : « Depuis ? » devient requise quand on répond « oui ».
    await expect(
      enrollInSeries(deps, customerActor(organizationId), {
        seriesId,
        customer,
        answers: { deja: "true" },
        participants: [{ answers: { age: "34" } }],
      }),
    ).rejects.toThrow("Vérifie les réponses");
    expect(
      await db.select().from(seriesEnrollment).where(eq(seriesEnrollment.seriesId, seriesId)),
    ).toHaveLength(0);

    const { enrollment, bookings } = await enrollInSeries(deps, customerActor(organizationId), {
      seriesId,
      customer,
      answers: { deja: "true", depuis: "2 ans" },
      participants: [{ answers: { age: "34" } }],
    });
    expect(bookings).toHaveLength(4);
    for (const entry of bookings) {
      expect(entry.answers).toEqual({ deja: true, depuis: "2 ans" });
      const [participant] = await db
        .select()
        .from(bookingParticipant)
        .where(eq(bookingParticipant.bookingId, entry.id));
      expect(participant).toMatchObject({ firstName: customer.firstName, answers: { age: 34 } });
    }
    const detail = await getEnrollment(db, organizationId, { id: enrollment.id });
    expect(detail?.answers).toMatchObject({
      answers: { deja: true, depuis: "2 ans" },
      participant: { age: 34 },
    });
  });
});

describe("rattrapages", () => {
  /** Une série de 4 mardis, et deux autres séances du même type : un jeudi à 1 place, puis un à 5. */
  async function courseWithMakeupSlots(options: { makeupAllowed?: boolean } = {}) {
    const main = await weeklyCourse({ capacity: 3, ...options });
    const slot = async (day: number, capacity: number) => {
      const [created] = await createEvent(deps, owner, {
        eventTypeId: main.eventTypeId,
        title: "Tournage du jeudi",
        startsAt: `2026-11-${day}T17:30:00Z`,
        endsAt: `2026-11-${day}T19:30:00Z`,
        timezone: "Europe/Paris",
        capacity,
        priceCents: 3000,
        paymentMode: "on_site",
      });
      return publishEvent(deps, owner, created?.id ?? "");
    };
    return { ...main, small: await slot(12, 1), roomy: await slot(19, 5) };
  }

  const sessionBooking = async (enrollmentId: string, eventId: string) => {
    const [found] = await db
      .select()
      .from(booking)
      .where(and(eq(booking.enrollmentId, enrollmentId), eq(booking.eventId, eventId)));
    return found?.id ?? "";
  };

  it("une absence signalée à temps donne une séance à rattraper, pas une absence tardive", async () => {
    const { seriesId, sessions } = await courseWithMakeupSlots();
    const { enrollment } = await enroll(seriesId);
    // Délai gratuit : 72 h. Séance du 10/11 à 17 h 30 : signalée le 5/11, c'est à temps.
    clock.set(new Date("2026-11-05T08:00:00Z"));
    const early = await sessionBooking(enrollment.id, sessions[1]?.id ?? "");
    expect(await reportAbsenceAsCustomer(deps, organizationId, early, "lea@mail.fr")).toMatchObject(
      { absentAt: clock.now(), makeupEligible: true },
    );
    // Séance du 17/11 signalée le 16/11 : tardive.
    clock.set(new Date("2026-11-16T08:00:00Z"));
    const late = await sessionBooking(enrollment.id, sessions[2]?.id ?? "");
    expect(await reportAbsenceAsCustomer(deps, organizationId, late, "lea@mail.fr")).toMatchObject({
      absentAt: clock.now(),
      makeupEligible: false,
    });
    await expect(
      bookMakeupAsCustomer(deps, organizationId, late, "lea@mail.fr", sessions[3]?.id ?? ""),
    ).rejects.toThrow("ne donne pas droit");
  });

  it("pas de rattrapage quand la série ne l'autorise pas", async () => {
    const { seriesId, sessions } = await courseWithMakeupSlots({ makeupAllowed: false });
    const { enrollment } = await enroll(seriesId);
    clock.set(new Date("2026-11-05T08:00:00Z"));
    const early = await sessionBooking(enrollment.id, sessions[1]?.id ?? "");
    expect(await reportAbsenceAsCustomer(deps, organizationId, early, "lea@mail.fr")).toMatchObject(
      { makeupEligible: false },
    );
  });

  it("l'élève réserve le rattrapage sur une autre séance du même type, dans la limite des places", async () => {
    const { seriesId, sessions, small, roomy } = await courseWithMakeupSlots();
    const { enrollment } = await enroll(seriesId);
    clock.set(new Date("2026-11-05T08:00:00Z"));
    const absent = await sessionBooking(enrollment.id, sessions[1]?.id ?? "");
    await reportAbsenceAsCustomer(deps, organizationId, absent, "lea@mail.fr");
    const book = (eventId: string, email = "lea@mail.fr") =>
      bookMakeupAsCustomer(deps, organizationId, absent, email, eventId);

    // Complète (1 place, prise par quelqu'un d'autre), la séance manquée, un autre compte.
    await createEventBooking(deps, customerActor(organizationId), {
      eventId: small.id,
      seats: 1,
      customer: contact("autre@mail.fr"),
    });
    // Séances proposées : même type, avant la fin de la série, avec une place libre.
    const [own] = await db
      .select({ customerId: booking.customerId })
      .from(booking)
      .where(eq(booking.id, absent));
    const proposed = await listMakeupTargets(db, organizationId, {
      absentEventId: sessions[1]?.id ?? "",
      seriesId,
      customerId: own?.customerId ?? "",
      now: clock.now(),
      publicOnly: true,
    });
    expect(proposed.map((target) => target.id)).toContain(roomy.id);
    expect(proposed.map((target) => target.id)).not.toContain(small.id);
    await expect(book(small.id)).rejects.toThrow("complet");
    await expect(book(sessions[1]?.id ?? "")).rejects.toThrow("séance que tu as manquée");
    await expect(book(roomy.id, "autre@mail.fr")).rejects.toThrow("introuvable");
    // Une séance déjà réservée par l'élève (celle du 24/11 de sa série) ne convient pas.
    await expect(book(sessions[3]?.id ?? "")).rejects.toThrow("déjà une place");

    const makeup = await book(roomy.id);
    expect(makeup).toMatchObject({
      status: "confirmed",
      amountCents: 0,
      eventId: roomy.id,
      enrollmentId: null,
      makeupForBookingId: absent,
    });
    await expect(book(roomy.id)).rejects.toThrow("déjà été rattrapée");

    const detail = await getEnrollment(db, organizationId, { id: enrollment.id }, clock.now());
    expect(detail?.makeups).toMatchObject([
      { absentBookingId: absent, state: "used", usedEventId: roomy.id },
    ]);

    // Utilisé, le rattrapage empêche d'annuler l'absence ; annulé, il la libère à nouveau.
    await expect(
      cancelAbsenceAsCustomer(deps, organizationId, absent, "lea@mail.fr"),
    ).rejects.toThrow("déjà réservé");
    await cancelBookingAsCustomer(deps, organizationId, makeup.id, "lea@mail.fr");
    expect(
      (await getEnrollment(db, organizationId, { id: enrollment.id }, clock.now()))?.makeups,
    ).toMatchObject([{ state: "available", usedEventId: null }]);
    expect((await book(roomy.id)).status).toBe("confirmed");
  });

  it("l'équipe attribue un rattrapage ; la désinscription le libère", async () => {
    const { seriesId, sessions, roomy } = await courseWithMakeupSlots();
    const { enrollment } = await enroll(seriesId);
    clock.set(new Date("2026-11-05T08:00:00Z"));
    const absent = await sessionBooking(enrollment.id, sessions[1]?.id ?? "");
    await reportAbsenceAsCustomer(deps, organizationId, absent, "lea@mail.fr");
    const makeup = await assignMakeup(deps, owner, absent, roomy.id);
    expect(makeup).toMatchObject({ status: "confirmed", makeupForBookingId: absent });
    await cancelEnrollment(deps, owner, enrollment.id);
    const [after] = await db.select().from(booking).where(eq(booking.id, makeup.id));
    expect(after?.status).toBe("cancelled");
  });

  it("l'élève reprend sa place en annulant son absence, si elle n'a pas été prise", async () => {
    const { seriesId, sessions } = await weeklyCourse({ capacity: 2 });
    const { enrollment, manageToken } = await enroll(seriesId);
    clock.set(new Date("2026-11-05T08:00:00Z"));
    const target = sessions[1]?.id ?? "";
    const id = await sessionBooking(enrollment.id, target);
    await reportAbsenceWithToken(deps, organizationId, manageToken, target);
    const back = await cancelAbsenceWithToken(deps, organizationId, manageToken, target);
    expect(back).toMatchObject({ id, status: "confirmed", absentAt: null, makeupEligible: false });
    await expect(cancelAbsenceWithToken(deps, organizationId, manageToken, target)).rejects.toThrow(
      "Aucune absence",
    );
  });

  it("la place reprise par la liste d'attente ne se récupère pas", async () => {
    const { seriesId, sessions } = await weeklyCourse({ capacity: 1, waitlist: true });
    const { manageToken } = await enroll(seriesId);
    const target = sessions[2]?.id ?? "";
    await createEventBooking(deps, customerActor(organizationId), {
      eventId: target,
      seats: 1,
      customer: contact("attente@mail.fr"),
    });
    await reportAbsenceWithToken(deps, organizationId, manageToken, target);
    await expect(cancelAbsenceWithToken(deps, organizationId, manageToken, target)).rejects.toThrow(
      "reprise par la liste d'attente",
    );
  });
});
