import type { Event } from "../events/model";
import { type Actor, actorRef, assertMemberCan } from "../shared/actor";
import { ConflictError, ForbiddenError, NotFoundError, ValidationError } from "../shared/errors";
import { generateToken, hashToken } from "../shared/tokens";
import type { Deps, Repositories } from "../shared/unit-of-work";
import { validate } from "../shared/validate";
import { decideBookingStatus, SEAT_HOLDING_STATUSES } from "./capacity";
import type { Booking } from "./model";
import { priceBooking } from "./pricing";
import { formatBookingReference, referencePeriod } from "./reference";
import { type CreateEventBookingInput, createEventBookingSchema } from "./schemas";
import type { BookingSource } from "./types";
import { promoteWaitlist } from "./waitlist";

const SOURCE_BY_ACTOR: Record<Actor["type"], BookingSource> = {
  member: "admin",
  customer: "public_page",
  system: "api",
};

/** Règles propres aux réservations faites par le client lui-même. */
function assertCustomerCanBook(
  event: Event,
  rules: { minAdvanceHours?: number; maxSeatsPerBooking?: number },
  seats: number,
  now: Date,
): void {
  if (event.visibility === "invite_only")
    throw new ForbiddenError("Cet événement est sur invitation");
  const closesAt = event.startsAt.getTime() - (rules.minAdvanceHours ?? 0) * 3_600_000;
  if (now.getTime() >= closesAt)
    throw new ConflictError("Les réservations sont closes pour cet événement");
  if (rules.maxSeatsPerBooking !== undefined && seats > rules.maxSeatsPerBooking) {
    throw new ValidationError(`${rules.maxSeatsPerBooking} places maximum par réservation`, [
      { path: "seats", message: `Maximum ${rules.maxSeatsPerBooking}` },
    ]);
  }
}

/**
 * Réserve des places sur un événement.
 *
 * Tout se passe sous le verrou de l'événement : lecture des places occupées, décision,
 * écriture. Deux demandes simultanées sur la dernière place sont donc traitées l'une
 * après l'autre, et il n'y a jamais de surréservation.
 *
 * Renvoie le jeton du lien « Gérer ma réservation » : il n'est jamais stocké en clair,
 * c'est la seule occasion de l'envoyer au client.
 */
export async function createEventBooking(
  deps: Deps,
  actor: Actor,
  input: CreateEventBookingInput,
): Promise<{ booking: Booking; manageToken: string }> {
  if (actor.type === "member") assertMemberCan(actor, "booking", "create");
  const data = validate(createEventBookingSchema, input);
  const manageToken = generateToken();
  const manageTokenHash = await hashToken(manageToken);

  const booking = await deps.uow.run(async (repositories) => {
    const locked = await repositories.events.lockForBooking(actor.organizationId, data.eventId);
    if (!locked || (actor.type === "customer" && locked.event.status === "draft")) {
      throw new NotFoundError("Événement", data.eventId);
    }
    const { event, eventType } = locked;
    const now = deps.clock.now();

    if (event.status !== "published") {
      throw new ConflictError(
        event.status === "cancelled"
          ? "Cet événement est annulé"
          : "Publie l'événement avant d'y inscrire quelqu'un",
      );
    }
    if (actor.type === "customer")
      assertCustomerCanBook(event, eventType.bookingRules, data.seats, now);
    if (event.endsAt <= now) throw new ConflictError("Cet événement est terminé");

    const status = decideBookingStatus({
      capacity: event.capacity,
      seatsHeld: await repositories.bookings.seatsHeld(event.id),
      seatsRequested: data.seats,
      // Une réservation saisie par l'équipe vaut validation.
      requiresApproval: actor.type !== "member" && event.requiresApproval,
      waitlistEnabled: eventType.bookingRules.waitlistEnabled ?? false,
    });

    const customer = await repositories.customers.upsertByEmail(
      actor.organizationId,
      data.customer,
    );
    const settings = await repositories.settings.get(actor.organizationId);
    const period = referencePeriod(now, settings.timezone);
    const sequence = await repositories.references.next(actor.organizationId, "booking", period);

    const created = await repositories.bookings.insert(
      {
        organizationId: actor.organizationId,
        reference: formatBookingReference(settings.bookingReferencePrefix, period, sequence),
        kind: "event",
        eventId: event.id,
        customerId: customer.id,
        seats: data.seats,
        status,
        ...priceBooking(event, data.seats),
        currency: event.currency,
        paymentMode: event.paymentMode,
        customerMessage: data.customerMessage,
        source: SOURCE_BY_ACTOR[actor.type],
        confirmedAt: status === "confirmed" ? now : null,
        manageTokenHash,
      },
      data.participants,
    );
    await repositories.activity.record({
      organizationId: actor.organizationId,
      entityType: "booking",
      entityId: created.id,
      action: "booking.created",
      ...actorRef(actor),
      data: { status, seats: data.seats },
    });
    return created;
  });

  return { booking, manageToken };
}

/**
 * Charge une réservation d'événement puis verrouille son événement, dans cet ordre
 * (toujours l'événement d'abord pour les écritures : pas d'interblocage), et la relit.
 */
async function lockBooking(repositories: Repositories, organizationId: string, bookingId: string) {
  const found = await repositories.bookings.find(organizationId, bookingId);
  if (!found?.eventId) throw new NotFoundError("Réservation", bookingId);
  const locked = await repositories.events.lockForBooking(organizationId, found.eventId);
  const booking = await repositories.bookings.find(organizationId, bookingId);
  if (!locked || !booking) throw new NotFoundError("Réservation", bookingId);
  return { booking, event: locked.event };
}

/** Valide une demande en attente (les places sont déjà retenues). */
export async function confirmBooking(
  deps: Deps,
  actor: Actor,
  bookingId: string,
): Promise<Booking> {
  assertMemberCan(actor, "booking", "update");

  return deps.uow.run(async (repositories) => {
    const { booking } = await lockBooking(repositories, actor.organizationId, bookingId);
    if (booking.status !== "pending") {
      throw new ConflictError("Seule une demande en attente peut être validée");
    }
    const confirmed = await repositories.bookings.updateStatus(actor.organizationId, bookingId, {
      status: "confirmed",
      confirmedAt: deps.clock.now(),
    });
    await repositories.activity.record({
      organizationId: actor.organizationId,
      entityType: "booking",
      entityId: bookingId,
      action: "booking.confirmed",
      ...actorRef(actor),
    });
    return confirmed;
  });
}

/** Refuse une demande (en attente ou en liste d'attente) ; les places libérées profitent à la liste d'attente. */
export async function refuseBooking(
  deps: Deps,
  actor: Actor,
  bookingId: string,
  reason?: string,
): Promise<Booking> {
  assertMemberCan(actor, "booking", "update");

  return deps.uow.run(async (repositories) => {
    const { booking, event } = await lockBooking(repositories, actor.organizationId, bookingId);
    if (booking.status !== "pending" && booking.status !== "waitlisted") {
      throw new ConflictError("Seule une demande en attente peut être refusée");
    }
    const refused = await repositories.bookings.updateStatus(actor.organizationId, bookingId, {
      status: "refused",
      refusalReason: reason?.trim() || null,
    });
    await repositories.activity.record({
      organizationId: actor.organizationId,
      entityType: "booking",
      entityId: bookingId,
      action: "booking.refused",
      ...actorRef(actor),
      data: { reason: reason ?? null },
    });
    if (SEAT_HOLDING_STATUSES.has(booking.status)) {
      await promoteWaitlist(repositories, event, actor, deps.clock.now());
    }
    return refused;
  });
}

async function cancelLocked(
  repositories: Repositories,
  actor: Actor,
  booking: Booking,
  event: Event,
  now: Date,
  reason: string | null,
): Promise<Booking> {
  if (booking.status === "cancelled" || booking.status === "refused") {
    throw new ConflictError("Cette réservation n'est plus active");
  }
  const cancelled = await repositories.bookings.updateStatus(booking.organizationId, booking.id, {
    status: "cancelled",
    cancelledAt: now,
  });
  await repositories.activity.record({
    organizationId: booking.organizationId,
    entityType: "booking",
    entityId: booking.id,
    action: "booking.cancelled",
    ...actorRef(actor),
    data: { reason },
  });
  if (SEAT_HOLDING_STATUSES.has(booking.status)) {
    await promoteWaitlist(repositories, event, actor, now);
  }
  return cancelled;
}

/** Annulation par l'équipe. */
export async function cancelBooking(
  deps: Deps,
  actor: Actor,
  bookingId: string,
  reason?: string,
): Promise<Booking> {
  assertMemberCan(actor, "booking", "cancel");

  return deps.uow.run(async (repositories) => {
    const { booking, event } = await lockBooking(repositories, actor.organizationId, bookingId);
    return cancelLocked(
      repositories,
      actor,
      booking,
      event,
      deps.clock.now(),
      reason?.trim() || null,
    );
  });
}

/** Annulation par le client depuis son lien « Gérer ma réservation », jusqu'au début de l'événement. */
export async function cancelBookingWithToken(
  deps: Deps,
  organizationId: string,
  manageToken: string,
): Promise<Booking> {
  const actor: Actor = { type: "customer", organizationId };
  const tokenHash = await hashToken(manageToken);

  return deps.uow.run(async (repositories) => {
    const found = await repositories.bookings.findByManageTokenHash(organizationId, tokenHash);
    if (!found) throw new NotFoundError("Réservation", "lien");
    const { booking, event } = await lockBooking(repositories, organizationId, found.id);
    const now = deps.clock.now();
    if (event.startsAt <= now) {
      throw new ConflictError("L'événement a commencé : contacte l'organisateur pour annuler");
    }
    return cancelLocked(repositories, actor, booking, event, now, "customer_request");
  });
}
