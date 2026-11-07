import { z } from "zod";
import { requireFeature } from "../billing/use-cases";
import { SEAT_HOLDING_STATUSES } from "../bookings/capacity";
import {
  counterCustomerChoice,
  refineCounterCustomer,
  resolveCounterCustomer,
} from "../bookings/counter";
import type { Booking } from "../bookings/model";
import { customerContactSchema } from "../bookings/schemas";
import { insertEventBooking, SOURCE_BY_ACTOR } from "../bookings/use-cases";
import { promoteWaitlist } from "../bookings/waitlist";
import type { EventSeries } from "../events/model";
import { type Actor, actorRef, assertMemberCan } from "../shared/actor";
import { ConflictError, ForbiddenError, NotFoundError } from "../shared/errors";
import { generateToken, hashToken } from "../shared/tokens";
import type { Deps, Repositories } from "../shared/unit-of-work";
import { validate } from "../shared/validate";
import type { Enrollment } from "./model";
import { assertEnrollmentFits, remainingSessions } from "./rules";
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
    const sessions = remainingSessions(
      await repositories.events.listSeriesEvents(actor.organizationId, series.id),
      now,
    );
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

    const settings = await repositories.settings.get(actor.organizationId);
    const enrollment = await repositories.enrollments.insert({
      organizationId: actor.organizationId,
      seriesId: series.id,
      customerId,
      amountCents: series.enrollmentPriceCents ?? 0,
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
          participants: [],
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
      data: { seriesId: series.id, sessions: bookings.length, paid: data.paid },
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
  change: { action: "booking.absent" | "booking.unenrolled"; absentAt: Date | null },
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
 * (Pas de rattrapage pour l'instant.)
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
  await releaseSession(repositories, actor, booking, now, {
    action: "booking.absent",
    absentAt: now,
  });
  return (await repositories.bookings.find(organizationId, booking.id)) ?? booking;
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
