import { z } from "zod";
import { requireFeature } from "../billing/use-cases";
import { remainingSeats, SEAT_HOLDING_STATUSES } from "../bookings/capacity";
import {
  counterCustomerChoice,
  refineCounterCustomer,
  resolveCounterCustomer,
} from "../bookings/counter";
import type { Booking } from "../bookings/model";
import { customerContactSchema, participantSchema } from "../bookings/schemas";
import { assertCustomerCanBook, insertEventBooking, SOURCE_BY_ACTOR } from "../bookings/use-cases";
import { promoteWaitlist } from "../bookings/waitlist";
import type { EventSeries } from "../events/model";
import { rawFieldValuesSchema } from "../fields/schemas";
import { cancellationPolicyOf } from "../modules/rules";
import { type Actor, actorRef, assertMemberCan } from "../shared/actor";
import { ConflictError, ForbiddenError, NotFoundError } from "../shared/errors";
import { generateToken, hashToken } from "../shared/tokens";
import type { Deps, Repositories } from "../shared/unit-of-work";
import { validate } from "../shared/validate";
import type { Enrollment } from "./model";
import {
  assertEnrollmentFits,
  enrollmentQuote,
  isMakeupEarned,
  makeupTargetIssue,
  remainingSessions,
} from "./rules";
import { type SeriesEnrollmentSettingsInput, seriesEnrollmentSettingsSchema } from "./schemas";

/**
 * Réglage « Inscription à la série » (cours à l'année). Il vit sur la série : le prix dépend
 * du nombre de séances et des dates, propres à chaque série d'un même type d'événement.
 */
export async function updateSeriesEnrollment(
  deps: Deps,
  actor: Actor,
  seriesId: string,
  input: SeriesEnrollmentSettingsInput,
): Promise<EventSeries> {
  assertMemberCan(actor, "event", "update");
  const data = validate(seriesEnrollmentSettingsSchema, input);
  return deps.uow.run(async (repositories) => {
    const series = await repositories.events.findSeries(actor.organizationId, seriesId);
    if (!series) throw new NotFoundError("Série", seriesId);
    const updated = await repositories.events.updateSeries(actor.organizationId, seriesId, {
      ...data,
      // Sans inscription à la série, la séance à l'unité est le seul moyen de réserver.
      dropInAllowed: data.enrollmentEnabled ? data.dropInAllowed : true,
    });
    const [first] = await repositories.events.listSeriesEvents(actor.organizationId, seriesId);
    if (first) {
      await repositories.activity.record({
        organizationId: actor.organizationId,
        entityType: "event",
        entityId: first.id,
        action: "event.updated",
        ...actorRef(actor),
        data: { fields: ["seriesEnrollment"], seriesId },
      });
    }
    return updated;
  });
}

export const enrollInSeriesSchema = z
  .object({
    seriesId: z.uuid(),
    ...counterCustomerChoice,
    /** Comptoir : payé sur place au moment de l'inscription. */
    paid: z.boolean().default(false),
    /** Questions « Ce que tu demandes » du type : posées une fois pour l'inscription… */
    answers: rawFieldValuesSchema.default({}),
    /** … et pour le participant (l'inscrit·e, une seule personne). */
    participants: z.array(participantSchema).max(1).default([]),
  })
  .superRefine(refineCounterCustomer);
export type EnrollInSeriesInput = z.input<typeof enrollInSeriesSchema>;

/**
 * Inscrit un client à toute une série : une place dans chaque séance restante, tout ou rien,
 * et un seul paiement (porté par l'inscription). Page publique (client, e-mail obligatoire)
 * ou comptoir (membre, client existant ou créé).
 *
 * Les séances sont verrouillées dans l'ordre chronologique (même ordre partout : pas
 * d'interblocage) ; aucune place ne peut donc partir entre la vérification et l'écriture.
 * Renvoie le jeton du lien de gestion de l'inscription, jamais stocké en clair.
 */
export async function enrollInSeries(
  deps: Deps,
  actor: Actor,
  input: EnrollInSeriesInput,
): Promise<{ enrollment: Enrollment; bookings: Booking[]; manageToken: string }> {
  if (actor.type === "member") assertMemberCan(actor, "booking", "create");
  else if (actor.type !== "customer") throw new ForbiddenError();
  const data = validate(enrollInSeriesSchema, input);
  if (actor.type === "customer") {
    // En ligne : un client sans compte se retrouve par son e-mail ; pas de paiement noté.
    validate(customerContactSchema.shape.email, data.customer?.email);
    if (data.customerId || data.paid) throw new ForbiddenError();
  }
  const manageToken = generateToken();
  const manageTokenHash = await hashToken(manageToken);

  return deps.uow.run(async (repositories) => {
    const now = deps.clock.now();
    if (actor.type === "member") {
      await requireFeature(repositories, actor.organizationId, "counter", now);
    }
    const series = await repositories.events.findSeries(actor.organizationId, data.seriesId);
    if (!series) throw new NotFoundError("Série", data.seriesId);
    if (!series.enrollmentEnabled) {
      throw new ConflictError("L'inscription à toute la série n'est pas ouverte");
    }
    const allEvents = await repositories.events.listSeriesEvents(actor.organizationId, series.id);
    const sessions = remainingSessions(allEvents, now);
    if (actor.type === "customer" && sessions.some((event) => event.visibility !== "public")) {
      throw new ForbiddenError("Cette série est sur invitation");
    }

    const locked = [];
    for (const session of sessions) {
      const entry = await repositories.events.lockForBooking(actor.organizationId, session.id);
      // Relue sous verrou : une séance annulée entre-temps est simplement sautée.
      if (entry?.event.status === "published") locked.push(entry);
    }
    const customerId = await resolveCounterCustomer(repositories, actor.organizationId, data);
    if (await repositories.enrollments.findActive(actor.organizationId, series.id, customerId)) {
      throw new ConflictError("Déjà inscrit·e à cette série");
    }
    const places = [];
    for (const { event } of locked) {
      const active = await repositories.bookings.listActive(event.id);
      places.push({
        startsAt: event.startsAt,
        capacity: event.capacity,
        seatsHeld: await repositories.bookings.seatsHeld(event.id),
        alreadyBooked: active.some((booking) => booking.customerId === customerId),
      });
    }
    assertEnrollmentFits(places, series.timezone);
    // Prix au prorata des séances restantes (séances publiées de la série, passées comprises).
    const quote = enrollmentQuote({
      fullCents: series.enrollmentPriceCents ?? 0,
      remaining: locked.length,
      total: allEvents.filter((event) => event.status === "published").length,
      prorata: series.enrollmentProrata,
    });

    const settings = await repositories.settings.get(actor.organizationId);
    const enrollment = await repositories.enrollments.insert({
      organizationId: actor.organizationId,
      seriesId: series.id,
      customerId,
      amountCents: quote.priceCents,
      currency: settings.currency,
      paidAt: data.paid ? now : null,
      source: SOURCE_BY_ACTOR[actor.type],
      manageTokenHash,
    });
    const bookings: Booking[] = [];
    for (const entry of locked) {
      bookings.push(
        await insertEventBooking(repositories, actor, entry, now, {
          customerId,
          seats: 1,
          answers: data.answers,
          participants: data.participants,
          customerMessage: null,
          manageTokenHash: null,
          enrollmentId: enrollment.id,
        }),
      );
    }
    await repositories.activity.record({
      organizationId: actor.organizationId,
      entityType: "enrollment",
      entityId: enrollment.id,
      action: "enrollment.created",
      ...actorRef(actor),
      data: {
        seriesId: series.id,
        sessions: bookings.length,
        paid: data.paid,
        prorated: quote.prorated,
      },
    });
    return { enrollment, bookings, manageToken };
  });
}

/** Libère la place d'une séance réservée par une inscription, sous le verrou de la séance. */
async function releaseSession(
  repositories: Repositories,
  actor: Actor,
  booking: Booking,
  now: Date,
  change: {
    action: "booking.absent" | "booking.unenrolled";
    absentAt: Date | null;
    makeupEligible?: boolean;
  },
): Promise<void> {
  const locked = booking.eventId
    ? await repositories.events.lockForBooking(booking.organizationId, booking.eventId)
    : null;
  if (!locked) throw new NotFoundError("Séance", booking.eventId ?? "");
  const fresh = await repositories.bookings.find(booking.organizationId, booking.id);
  if (!fresh || !SEAT_HOLDING_STATUSES.has(fresh.status)) return;
  await repositories.bookings.updateStatus(booking.organizationId, booking.id, {
    status: "cancelled",
    cancelledAt: now,
    absentAt: change.absentAt,
    makeupEligible: change.makeupEligible ?? false,
  });
  await repositories.activity.record({
    organizationId: booking.organizationId,
    entityType: "booking",
    entityId: booking.id,
    action: change.action,
    ...actorRef(actor),
  });
  // La place libérée profite à la liste d'attente existante.
  await promoteWaitlist(repositories, locked.event, actor, now);
}

/**
 * « Je serai absent·e » : le client libère sa place sur une séance à venir, depuis le lien de
 * gestion de son inscription. L'inscription reste ; la place passe à la liste d'attente.
 * Signalée dans le délai d'annulation gratuite (et si la série autorise les rattrapages),
 * l'absence donne une séance à rattraper.
 */
export async function reportAbsenceWithToken(
  deps: Deps,
  organizationId: string,
  manageToken: string,
  eventId: string,
): Promise<Booking> {
  const tokenHash = await hashToken(manageToken);
  return deps.uow.run(async (repositories) => {
    const enrollment = await repositories.enrollments.findByManageTokenHash(
      organizationId,
      tokenHash,
    );
    if (!enrollment) throw new NotFoundError("Inscription", "lien");
    const booking = (await repositories.enrollments.listBookings(enrollment.id)).find(
      (entry) => entry.eventId === eventId,
    );
    if (!booking) throw new NotFoundError("Séance", eventId);
    return reportAbsence(deps, repositories, enrollment, booking);
  });
}

/** Séance d'une inscription, retrouvée par le client connecté (e-mail de sa fiche client). */
async function ownEnrollmentBooking(
  repositories: Repositories,
  organizationId: string,
  bookingId: string,
  email: string,
) {
  const booking = await repositories.bookings.find(organizationId, bookingId);
  const enrollment = booking?.enrollmentId
    ? await repositories.enrollments.find(organizationId, booking.enrollmentId)
    : null;
  const customer = enrollment
    ? await repositories.customers.find(organizationId, enrollment.customerId)
    : null;
  if (!booking || !enrollment || customer?.email?.toLowerCase() !== email.toLowerCase()) {
    throw new NotFoundError("Séance", bookingId);
  }
  return { booking, enrollment };
}

/**
 * « Je serai absent·e » depuis l'espace client (lot 29) : la séance doit appartenir à une
 * inscription dont la fiche client porte l'e-mail du compte connecté.
 */
export async function reportAbsenceAsCustomer(
  deps: Deps,
  organizationId: string,
  bookingId: string,
  email: string,
): Promise<Booking> {
  return deps.uow.run(async (repositories) => {
    const { booking, enrollment } = await ownEnrollmentBooking(
      repositories,
      organizationId,
      bookingId,
      email,
    );
    return reportAbsence(deps, repositories, enrollment, booking);
  });
}

async function reportAbsence(
  deps: Deps,
  repositories: Repositories,
  enrollment: Enrollment,
  booking: Booking,
): Promise<Booking> {
  const { organizationId } = enrollment;
  const actor: Actor = { type: "customer", organizationId };
  if (enrollment.cancelledAt) throw new ConflictError("Cette inscription est terminée");
  if (booking.absentAt) throw new ConflictError("Absence déjà signalée pour cette séance");
  if (!SEAT_HOLDING_STATUSES.has(booking.status)) {
    throw new ConflictError("Cette séance n'est plus réservée");
  }
  const event = booking.eventId
    ? await repositories.events.find(organizationId, booking.eventId)
    : null;
  const now = deps.clock.now();
  if (!event || event.startsAt <= now) {
    throw new ConflictError("La séance a commencé : préviens directement l'atelier");
  }
  const series = await repositories.events.findSeries(organizationId, enrollment.seriesId);
  const { freeCancellationHours } = cancellationPolicyOf(
    event.modules,
    await repositories.settings.get(organizationId),
  );
  await releaseSession(repositories, actor, booking, now, {
    action: "booking.absent",
    absentAt: now,
    makeupEligible: isMakeupEarned({
      makeupAllowed: series?.makeupAllowed ?? false,
      startsAt: event.startsAt,
      now,
      freeCancellationHours,
    }),
  });
  return (await repositories.bookings.find(organizationId, booking.id)) ?? booking;
}

/**
 * « Annuler mon absence » : tant que la séance n'a pas commencé, le client reprend sa place
 * (si elle n'a pas été prise entre-temps) et le rattrapage non utilisé disparaît.
 */
export async function cancelAbsenceWithToken(
  deps: Deps,
  organizationId: string,
  manageToken: string,
  eventId: string,
): Promise<Booking> {
  const tokenHash = await hashToken(manageToken);
  return deps.uow.run(async (repositories) => {
    const enrollment = await repositories.enrollments.findByManageTokenHash(
      organizationId,
      tokenHash,
    );
    if (!enrollment) throw new NotFoundError("Inscription", "lien");
    const booking = (await repositories.enrollments.listBookings(enrollment.id)).find(
      (entry) => entry.eventId === eventId,
    );
    if (!booking) throw new NotFoundError("Séance", eventId);
    return cancelAbsence(deps, repositories, enrollment, booking);
  });
}

export async function cancelAbsenceAsCustomer(
  deps: Deps,
  organizationId: string,
  bookingId: string,
  email: string,
): Promise<Booking> {
  return deps.uow.run(async (repositories) => {
    const { booking, enrollment } = await ownEnrollmentBooking(
      repositories,
      organizationId,
      bookingId,
      email,
    );
    return cancelAbsence(deps, repositories, enrollment, booking);
  });
}

async function cancelAbsence(
  deps: Deps,
  repositories: Repositories,
  enrollment: Enrollment,
  booking: Booking,
): Promise<Booking> {
  const { organizationId } = enrollment;
  if (enrollment.cancelledAt) throw new ConflictError("Cette inscription est terminée");
  if (!booking.absentAt || !booking.eventId) {
    throw new ConflictError("Aucune absence signalée pour cette séance");
  }
  const locked = await repositories.events.lockForBooking(organizationId, booking.eventId);
  const now = deps.clock.now();
  if (!locked || locked.event.status !== "published" || locked.event.startsAt <= now) {
    throw new ConflictError("La séance a commencé : préviens directement l'atelier");
  }
  const fresh = await repositories.bookings.find(organizationId, booking.id);
  if (!fresh?.absentAt) throw new ConflictError("Aucune absence signalée pour cette séance");
  if (await repositories.enrollments.findActiveMakeup(fresh.id)) {
    throw new ConflictError("Ton rattrapage est déjà réservé : annule-le d'abord");
  }
  const left = remainingSeats(
    locked.event.capacity,
    await repositories.bookings.seatsHeld(locked.event.id),
  );
  if (left !== null && left < fresh.seats) {
    throw new ConflictError("Ta place a été reprise par la liste d'attente");
  }
  const restored = await repositories.bookings.updateStatus(organizationId, fresh.id, {
    status: "confirmed",
    cancelledAt: null,
    absentAt: null,
    makeupEligible: false,
  });
  await repositories.activity.record({
    organizationId,
    entityType: "booking",
    entityId: fresh.id,
    action: "booking.absence_cancelled",
    ...actorRef({ type: "customer", organizationId }),
  });
  return restored;
}

/**
 * Séance à rattraper : réserve une autre séance du même type d'événement, avant la fin du
 * trimestre et dans la limite des places. Par le client (espace client) ou attribuée par l'équipe.
 */
async function createMakeup(
  deps: Deps,
  repositories: Repositories,
  actor: Actor,
  enrollment: Enrollment,
  absent: Booking,
  targetEventId: string,
): Promise<Booking> {
  const { organizationId } = enrollment;
  const series = await repositories.events.findSeries(organizationId, enrollment.seriesId);
  if (!series?.makeupAllowed) {
    throw new ConflictError("Les rattrapages ne sont pas ouverts pour cette série");
  }
  if (enrollment.cancelledAt) throw new ConflictError("Cette inscription est terminée");
  if (!absent.absentAt || !absent.makeupEligible || !absent.eventId) {
    throw new ConflictError("Cette absence ne donne pas droit à un rattrapage");
  }
  const absentEvent = await repositories.events.find(organizationId, absent.eventId);
  const locked = await repositories.events.lockForBooking(organizationId, targetEventId);
  if (!absentEvent || !locked) throw new NotFoundError("Séance", targetEventId);
  if (await repositories.enrollments.findActiveMakeup(absent.id)) {
    throw new ConflictError("Cette séance a déjà été rattrapée");
  }
  const now = deps.clock.now();
  const seriesEvents = await repositories.events.listSeriesEvents(organizationId, series.id);
  const seriesEndsAt = seriesEvents
    .filter((event) => event.status === "published")
    .reduce((end, event) => (event.endsAt > end ? event.endsAt : end), absentEvent.endsAt);
  const issue = makeupTargetIssue({
    absent: absentEvent,
    target: locked.event,
    seriesEndsAt,
    now,
  });
  if (issue) throw new ConflictError(issue);
  if (actor.type === "customer") {
    assertCustomerCanBook(locked.event, 1, now, null);
  }
  const active = await repositories.bookings.listActive(locked.event.id);
  if (active.some((entry) => entry.customerId === enrollment.customerId)) {
    throw new ConflictError("Tu as déjà une place sur cette séance");
  }
  return insertEventBooking(repositories, actor, locked, now, {
    customerId: enrollment.customerId,
    seats: 1,
    participants: [],
    customerMessage: null,
    manageTokenHash: null,
    makeupForBookingId: absent.id,
  });
}

export async function bookMakeupAsCustomer(
  deps: Deps,
  organizationId: string,
  absentBookingId: string,
  email: string,
  targetEventId: string,
): Promise<Booking> {
  const actor: Actor = { type: "customer", organizationId };
  return deps.uow.run(async (repositories) => {
    const { booking, enrollment } = await ownEnrollmentBooking(
      repositories,
      organizationId,
      absentBookingId,
      email,
    );
    return createMakeup(deps, repositories, actor, enrollment, booking, targetEventId);
  });
}

/** L'équipe attribue un rattrapage à un·e inscrit·e (séance à rattraper → séance choisie). */
export async function assignMakeup(
  deps: Deps,
  actor: Actor,
  absentBookingId: string,
  targetEventId: string,
): Promise<Booking> {
  assertMemberCan(actor, "booking", "create");
  return deps.uow.run(async (repositories) => {
    const absent = await repositories.bookings.find(actor.organizationId, absentBookingId);
    const enrollment = absent?.enrollmentId
      ? await repositories.enrollments.find(actor.organizationId, absent.enrollmentId)
      : null;
    if (!absent || !enrollment) throw new NotFoundError("Séance", absentBookingId);
    return createMakeup(deps, repositories, actor, enrollment, absent, targetEventId);
  });
}

/**
 * Désinscription par l'équipe : les séances à venir sont libérées (liste d'attente), les
 * séances passées restent dans l'historique.
 */
export async function cancelEnrollment(
  deps: Deps,
  actor: Actor,
  enrollmentId: string,
): Promise<{ enrollment: Enrollment; releasedSessions: number }> {
  assertMemberCan(actor, "booking", "cancel");
  return deps.uow.run(async (repositories) => {
    const enrollment = await repositories.enrollments.find(actor.organizationId, enrollmentId);
    if (!enrollment) throw new NotFoundError("Inscription", enrollmentId);
    if (enrollment.cancelledAt) throw new ConflictError("Cette inscription est déjà annulée");
    const now = deps.clock.now();
    const events = await repositories.events.listSeriesEvents(
      actor.organizationId,
      enrollment.seriesId,
    );
    const upcoming = new Set(
      events.filter((event) => event.startsAt > now).map((event) => event.id),
    );
    const bookings = await repositories.enrollments.listBookings(enrollment.id);
    let releasedSessions = 0;
    // Même ordre que l'inscription (chronologique) : pas d'interblocage.
    for (const event of events) {
      if (!upcoming.has(event.id)) continue;
      const booking = bookings.find(
        (entry) => entry.eventId === event.id && SEAT_HOLDING_STATUSES.has(entry.status),
      );
      if (!booking) continue;
      await releaseSession(repositories, actor, booking, now, {
        action: "booking.unenrolled",
        absentAt: null,
      });
      releasedSessions++;
    }
    // Un rattrapage à venir part avec l'inscription.
    for (const absent of bookings.filter((entry) => entry.absentAt)) {
      const makeup = await repositories.enrollments.findActiveMakeup(absent.id);
      const makeupEvent = makeup?.eventId
        ? await repositories.events.find(actor.organizationId, makeup.eventId)
        : null;
      if (makeup && makeupEvent && makeupEvent.startsAt > now) {
        await releaseSession(repositories, actor, makeup, now, {
          action: "booking.unenrolled",
          absentAt: null,
        });
        releasedSessions++;
      }
    }
    const cancelled = await repositories.enrollments.update(actor.organizationId, enrollmentId, {
      cancelledAt: now,
    });
    await repositories.activity.record({
      organizationId: actor.organizationId,
      entityType: "enrollment",
      entityId: enrollmentId,
      action: "enrollment.cancelled",
      ...actorRef(actor),
      data: { releasedSessions },
    });
    return { enrollment: cancelled, releasedSessions };
  });
}

/** Paiement de l'inscription noté (ou retiré) par l'équipe : lien externe, sur place. */
export async function setEnrollmentPaid(
  deps: Deps,
  actor: Actor,
  enrollmentId: string,
  paid: boolean,
): Promise<Enrollment> {
  assertMemberCan(actor, "booking", "update");
  return deps.uow.run(async (repositories) => {
    const enrollment = await repositories.enrollments.find(actor.organizationId, enrollmentId);
    if (!enrollment) throw new NotFoundError("Inscription", enrollmentId);
    if (paid === (enrollment.paidAt !== null)) return enrollment;
    const updated = await repositories.enrollments.update(actor.organizationId, enrollmentId, {
      paidAt: paid ? deps.clock.now() : null,
    });
    await repositories.activity.record({
      organizationId: actor.organizationId,
      entityType: "enrollment",
      entityId: enrollmentId,
      action: paid ? "enrollment.paid" : "enrollment.unpaid",
      ...actorRef(actor),
    });
    return updated;
  });
}
