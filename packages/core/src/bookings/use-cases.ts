import type { CalendarLink } from "../calendar-links/model";
import { calendarLinkAllows } from "../calendar-links/rules";
import type { Event, EventType } from "../events/model";
import type { RawFieldValues } from "../fields/model";
import { validateBookingAnswers } from "../fields/values";
import { applyGiftCardToBooking, restoreGiftCardForBooking } from "../gift-cards/use-cases";
import { reserveEquipment } from "../inventory/equipment";
import type { EquipmentChoice } from "../modules/registry";
import { optionNeedSeats } from "../modules/resources";
import {
  ageIssues,
  bookingWindow,
  cancellationPolicyOf,
  hasAccessTag,
  windowState,
} from "../modules/rules";
import { recreditPassForBooking } from "../passes/use-cases";
import { paidCents } from "../payments/rules";
import { checkSubmissionRules, recordRuleRuns, runBookingRules } from "../rules/use-cases";
import { type Actor, actorRef, assertMemberCan } from "../shared/actor";
import { ConflictError, ForbiddenError, NotFoundError, ValidationError } from "../shared/errors";
import { generateToken, hashToken } from "../shared/tokens";
import { findSlotHold, lockSlotEvent } from "../slots/use-cases";
import type { Deps, Repositories } from "../shared/unit-of-work";
import { validate } from "../shared/validate";
import { decideBookingStatus, SEAT_HOLDING_STATUSES } from "./capacity";
import { CHECK_IN_OPENS_BEFORE_HOURS, isCheckInOpen } from "./check-in";
import type { Booking } from "./model";
import { type PriceAdjustment, type PriceSelection, quoteBooking } from "./pricing";
import { formatBookingReference, referencePeriod } from "./reference";
import { rescheduleClosedReason, reschedulePricing, rescheduleTargetIssue } from "./reschedule";
import { type CreateEventBookingInput, createEventBookingSchema } from "./schemas";
import type { BookingSource } from "./types";
import { promoteWaitlist } from "./waitlist";

export const SOURCE_BY_ACTOR: Record<Actor["type"], BookingSource> = {
  member: "admin",
  customer: "public_page",
  system: "api",
};

/**
 * Règles propres aux réservations faites par le client lui-même, selon les modules copiés sur
 * l'événement (ouverture, places par inscription). Un événement « sur invitation » n'est
 * réservable que par un lien calendrier actif qui le contient.
 */
export function assertCustomerCanBook(
  event: Event,
  seats: number,
  now: Date,
  link: CalendarLink | null,
): void {
  if (event.visibility === "invite_only" && !(link && calendarLinkAllows(link, event)))
    throw new ForbiddenError("Cet événement est sur invitation");
  const state = windowState(bookingWindow(event.startsAt, event.modules.opening), now);
  if (state === "upcoming") throw new ConflictError("Les inscriptions ne sont pas encore ouvertes");
  if (state === "closed")
    throw new ConflictError("Les réservations sont closes pour cet événement");
  const max = event.modules.places?.maxPerBooking;
  if (max !== undefined && seats > max) {
    throw new ValidationError(`${max} place${max > 1 ? "s" : ""} maximum par réservation`, [
      { path: "seats", message: `Maximum ${max}` },
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
): Promise<{ booking: Booking; manageToken: string; giftCardCents: number }> {
  if (actor.type === "member") assertMemberCan(actor, "booking", "create");
  const data = validate(createEventBookingSchema, input);
  const manageToken = generateToken();
  const manageTokenHash = await hashToken(manageToken);

  const { booking, giftCardCents } = await deps.uow.run(async (repositories) => {
    const now = deps.clock.now();
    // Créneau gardé : revérifié sous le verrou des créneaux, son événement créé au besoin.
    const hold = data.holdId
      ? await findSlotHold(repositories, actor.organizationId, data.holdId)
      : null;
    const locked = hold
      ? await lockSlotEvent(
          repositories,
          actor,
          {
            eventTypeId: hold.eventTypeId,
            startsAt: hold.startsAt,
            durationId: hold.durationId,
            staffMemberId: hold.staffMemberId,
            seats: data.seats,
          },
          now,
          hold.id,
        )
      : await repositories.events.lockForBooking(actor.organizationId, data.eventId as string);
    if (!locked || (actor.type === "customer" && locked.event.status === "draft")) {
      throw new NotFoundError("Événement", data.eventId ?? "");
    }
    const { event } = locked;

    if (event.status !== "published") {
      throw new ConflictError(
        event.status === "cancelled"
          ? "Cet événement est annulé"
          : "Publie l'événement avant d'y inscrire quelqu'un",
      );
    }
    if (actor.type === "customer") {
      const link = data.calendarLinkSlug
        ? await repositories.calendarLinks.findBySlug(actor.organizationId, data.calendarLinkSlug)
        : null;
      assertCustomerCanBook(event, data.seats, now, link);
      const series = event.seriesId
        ? await repositories.events.findSeries(actor.organizationId, event.seriesId)
        : null;
      if (series?.enrollmentEnabled && !series.dropInAllowed) {
        throw new ConflictError("Ce cours se réserve pour toute la série, pas à la séance");
      }
    }
    const customer = await repositories.customers.upsertByEmail(
      actor.organizationId,
      data.customer,
    );
    const created = await insertEventBooking(repositories, actor, locked, now, {
      customerId: customer.id,
      seats: data.seats,
      answers: data.answers,
      participants: data.participants,
      customerMessage: data.customerMessage,
      manageTokenHash,
      equipment: data.equipment,
      selection: { rates: data.rates, options: data.options },
    });
    if (hold) await repositories.slots.deleteHold(actor.organizationId, hold.id);
    // Sur liste d'attente, rien à payer encore : le bon n'est pas touché.
    const giftCardCents =
      data.giftCardCode && created.status !== "waitlisted"
        ? await applyGiftCardToBooking(repositories, actor, created, data.giftCardCode, now)
        : 0;
    return { booking: created, giftCardCents };
  });

  return { booking, manageToken, giftCardCents };
}

/** Participant tel qu'il arrive d'un formulaire (réponses encore brutes). */
export interface RawParticipant {
  firstName: string;
  lastName: string;
  email: string | null;
  answers: RawFieldValues;
}

/**
 * Écriture d'une réservation d'événement, sous le verrou de l'événement : réponses validées
 * contre les champs de l'événement (une ligne de participant par place), décision
 * (confirmée, en attente, liste d'attente), référence, insertion et journal.
 */
export async function insertEventBooking(
  repositories: Repositories,
  actor: Actor,
  { event }: { event: Event; eventType: EventType },
  now: Date,
  data: {
    customerId: string;
    seats: number;
    answers?: RawFieldValues;
    participants: RawParticipant[];
    customerMessage: string | null;
    manageTokenHash: string | null;
    /** Module Matériel avancé : cases cochées et exemplaires choisis par le client. */
    equipment?: EquipmentChoice[];
    /** Tarifs et options choisis (lot 35). */
    selection?: PriceSelection;
    /** Séance d'une inscription à la série : confirmée d'office, payée par l'inscription. */
    enrollmentId?: string;
    /** Rattrapage d'une absence : confirmé d'office, sans paiement ni question. */
    makeupForBookingId?: string;
    /** Séances 2 et suivantes d'une inscription à la série : les règles n'envoient rien de plus. */
    quietRules?: boolean;
    /** Stage « même matériel » : le matériel est réservé ensuite pour toutes les séances. */
    skipEquipment?: boolean;
  },
): Promise<Booking> {
  if (event.endsAt <= now) throw new ConflictError("Cet événement est terminé");
  const makeup = data.makeupForBookingId !== undefined;
  const enrolled = data.enrollmentId !== undefined || makeup;
  // Un rattrapage ne pose pas de question : l'inscription a déjà répondu.
  const participants = makeup
    ? []
    : Array.from(
        { length: data.seats },
        (_, index) =>
          data.participants[index] ?? { firstName: "", lastName: "", email: null, answers: {} },
      );
  // La première place, sans nom, est celle du client (comptoir, saisie de l'équipe).
  const first = participants[0];
  if (first && !first.firstName && !first.lastName) {
    const customer = await repositories.customers.find(actor.organizationId, data.customerId);
    if (customer) {
      participants[0] = {
        ...first,
        firstName: customer.firstName,
        lastName: customer.lastName,
        email: customer.email,
      };
    }
  }
  const answered = validateBookingAnswers(
    event.fields,
    { answers: makeup ? {} : (data.answers ?? {}), participants },
    // L'équipe saisit ce qu'elle sait : les questions requises le sont pour le client.
    { now, enforceRequired: actor.type !== "member" && !makeup },
  );
  // Le prix choisi, avant les règles : refuse tôt un tarif ou une option inconnus.
  const chosen = enrolled ? [] : quoteBooking(event, data.seats, data.selection).lines;
  // Règles « Une inscription est envoyée » (lot 36) : questions en plus, refus, validation, prix.
  // Un rattrapage n'en relève pas : l'inscription d'origine est déjà passée par elles.
  const rules = makeup
    ? null
    : await checkSubmissionRules(repositories, event, {
        customerId: data.customerId,
        answers: answered.answers,
        participants: answered.participants,
        lines: chosen,
        rawAnswers: data.answers ?? {},
        now,
        enrollmentId: data.enrollmentId,
        enforceRequired: actor.type !== "member",
      });
  // Conditions d'accès (module) : contrôlées pour le client, l'équipe garde la main.
  const issues = [
    ...answered.issues,
    ...(rules?.issues ?? []),
    ...(actor.type === "member" ? [] : ageIssues(event.modules.access, answered.participants)),
  ];
  if (issues.length > 0) {
    throw new ValidationError("Vérifie les réponses en rouge.", issues);
  }
  // Un refus par règle vaut pour le client ; l'équipe garde la main (comme pour l'accès).
  if (rules?.outcome.refusal && actor.type !== "member") {
    throw new ConflictError(rules.outcome.refusal);
  }
  const requiredTags = event.modules.access?.tags;
  if (actor.type === "customer" && requiredTags?.length) {
    const customer = await repositories.customers.find(actor.organizationId, data.customerId);
    if (!hasAccessTag(event.modules.access, customer?.tags ?? [])) {
      throw new ForbiddenError(
        `Inscription réservée (${requiredTags.join(", ")}) : contacte l'atelier`,
      );
    }
  }

  const status = decideBookingStatus({
    capacity: event.capacity,
    seatsHeld: await repositories.bookings.seatsHeld(event.id),
    seatsRequested: data.seats,
    // Une réservation saisie par l'équipe vaut validation ; l'inscription à la série aussi.
    requiresApproval:
      !enrolled &&
      actor.type !== "member" &&
      (event.requiresApproval || Boolean(rules?.outcome.approval)),
    waitlistEnabled: !enrolled && Boolean(event.modules.waitlist),
  });

  const settings = await repositories.settings.get(actor.organizationId);
  const period = referencePeriod(now, settings.timezone);
  const sequence = await repositories.references.next(actor.organizationId, "booking", period);

  const created = await repositories.bookings.insert(
    {
      organizationId: actor.organizationId,
      reference: formatBookingReference(settings.bookingReferencePrefix, period, sequence),
      kind: "event",
      eventId: event.id,
      customerId: data.customerId,
      seats: data.seats,
      status,
      ...(enrolled
        ? { amountCents: 0, depositCents: null, priceLines: [] }
        : priceOf(event, data.seats, data.selection, rules?.outcome.adjustments)),
      currency: event.currency,
      paymentMode: enrolled ? "free" : event.paymentMode,
      enrollmentId: data.enrollmentId ?? null,
      makeupForBookingId: data.makeupForBookingId ?? null,
      customerMessage: data.customerMessage,
      answers: { ...answered.answers, ...rules?.answers },
      source: SOURCE_BY_ACTOR[actor.type],
      confirmedAt: status === "confirmed" ? now : null,
      manageTokenHash: data.manageTokenHash,
    },
    answered.participants,
  );
  // Matériel avancé : réservé avec la place (sauf liste d'attente, rien n'est encore retenu).
  if (status !== "waitlisted" && !data.skipEquipment) {
    await reserveEquipment(
      repositories,
      actor,
      event,
      created.id,
      data.seats,
      data.equipment ?? [],
      actor.type !== "customer" || enrolled,
      optionNeedSeats(event, data.seats, created.priceLines),
    );
  }
  await repositories.activity.record({
    organizationId: actor.organizationId,
    entityType: "booking",
    entityId: created.id,
    // « enrolled » et rattrapage : pas d'e-mail par séance, l'inscription envoie son propre récapitulatif.
    action: makeup ? "booking.makeup" : enrolled ? "booking.enrolled" : "booking.created",
    ...actorRef(actor),
    data: {
      status,
      seats: data.seats,
      ...(makeup && { absentBookingId: data.makeupForBookingId }),
    },
  });
  // Journal des règles : seulement ce qui a vraiment agi (l'équipe n'est ni refusée ni mise
  // en validation ; une séance d'inscription à la série est confirmée d'office).
  const skipped = new Set<string>([
    ...(actor.type === "member" ? ["refuse"] : []),
    ...(status !== "pending" || enrolled ? ["require_approval"] : []),
    // Séance payée par l'inscription à la série : pas de prix à changer.
    ...(enrolled ? ["price"] : []),
  ]);
  await recordRuleRuns(repositories, actor, {
    event,
    bookingId: created.id,
    trigger: "booking_submitted",
    runs: (rules?.outcome.matched ?? []).map((rule) => ({
      rule,
      actions: rule.actions.filter((action) => !skipped.has(action.kind)),
    })),
    notify: !data.quietRules,
  });
  return created;
}

function priceOf(
  event: Event,
  seats: number,
  selection: PriceSelection | undefined,
  adjustments: readonly PriceAdjustment[] = [],
) {
  const { lines, ...amounts } = quoteBooking(event, seats, selection, adjustments);
  return { ...amounts, priceLines: lines };
}

/**
 * Charge une réservation puis verrouille son événement, dans cet ordre (toujours
 * l'événement d'abord pour les écritures : pas d'interblocage), et la relit.
 * Une location de matériel n'a pas d'événement : `event` vaut alors null.
 */
async function lockBooking(repositories: Repositories, organizationId: string, bookingId: string) {
  const found = await repositories.bookings.find(organizationId, bookingId);
  if (!found) throw new NotFoundError("Réservation", bookingId);
  if (!found.eventId) return { booking: found, event: null };
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
    await repositories.inventory.releaseBookingAllocations(actor.organizationId, bookingId);
    await recreditPassForBooking(
      repositories,
      actor,
      booking,
      event?.startsAt ?? null,
      deps.clock.now(),
      "always",
    );
    await restoreGiftCardForBooking(repositories, booking, "organizer", null, deps.clock.now());
    if (event && SEAT_HOLDING_STATUSES.has(booking.status)) {
      await runBookingRules(repositories, actor, "seat_released", event, booking, deps.clock.now());
      await promoteWaitlist(repositories, event, actor, deps.clock.now());
    }
    return refused;
  });
}

/**
 * Check-in du jour J : pointe l'arrivée d'une réservation confirmée (toute la réservation,
 * accompagnants compris), ou annule le pointage. Ne touche pas aux places.
 */
export async function setBookingCheckIn(
  deps: Deps,
  actor: Actor,
  bookingId: string,
  present: boolean,
): Promise<Booking> {
  assertMemberCan(actor, "booking", "update");

  return deps.uow.run(async (repositories) => {
    const booking = await repositories.bookings.find(actor.organizationId, bookingId);
    if (!booking) throw new NotFoundError("Réservation", bookingId);
    const event = booking.eventId
      ? await repositories.events.find(actor.organizationId, booking.eventId)
      : null;
    if (!event) throw new ConflictError("Le check-in concerne les réservations d'événement");
    if (booking.status !== "confirmed") {
      throw new ConflictError("Seule une réservation confirmée peut être pointée");
    }
    if (event.status === "cancelled") throw new ConflictError("Cet événement est annulé");
    const now = deps.clock.now();
    if (!isCheckInOpen(event, now)) {
      throw new ConflictError(
        `Le check-in ouvre ${CHECK_IN_OPENS_BEFORE_HOURS} h avant le début de l'événement`,
      );
    }
    if (present === (booking.checkedInAt !== null)) return booking;

    const updated = await repositories.bookings.setCheckedIn(
      actor.organizationId,
      bookingId,
      present ? now : null,
    );
    await repositories.activity.record({
      organizationId: actor.organizationId,
      entityType: "booking",
      entityId: bookingId,
      action: present ? "booking.checked_in" : "booking.check_in_undone",
      ...actorRef(actor),
    });
    return updated;
  });
}

async function cancelLocked(
  repositories: Repositories,
  actor: Actor,
  booking: Booking,
  event: Event | null,
  now: Date,
  reason: string | null,
  recredit?: boolean,
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
  await recreditPassForBooking(
    repositories,
    actor,
    booking,
    event?.startsAt ?? booking.rentalStartsAt,
    now,
    recredit,
  );
  // Location : les exemplaires bloqués redeviennent libres. Événement : le matériel
  // attribué à la réservation (comptoir) retourne au matériel de l'événement.
  if (booking.kind === "rental") {
    await repositories.inventory.cancelAllocations(
      booking.organizationId,
      { bookingId: booking.id },
      now,
    );
  } else {
    await repositories.inventory.releaseBookingAllocations(booking.organizationId, booking.id);
  }
  await restoreGiftCardForBooking(
    repositories,
    booking,
    actor.type === "customer" ? "customer" : "organizer",
    event?.startsAt ?? booking.rentalStartsAt,
    now,
  );
  if (event) await runBookingRules(repositories, actor, "booking_cancelled", event, booking, now);
  if (event && SEAT_HOLDING_STATUSES.has(booking.status)) {
    await runBookingRules(repositories, actor, "seat_released", event, booking, now);
    await promoteWaitlist(repositories, event, actor, now);
  }
  return cancelled;
}

/**
 * Annulation par l'équipe. `recredit` : la séance est-elle rendue sur la carte qui a payé ?
 * Sans choix, oui dans le délai d'annulation gratuite, non après.
 */
export async function cancelBooking(
  deps: Deps,
  actor: Actor,
  bookingId: string,
  reason?: string,
  recredit?: boolean,
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
      recredit,
    );
  });
}

/**
 * Annulation automatique dans une transaction déjà ouverte (paiement en ligne abandonné) :
 * les places sont libérées et la liste d'attente monte.
 */
export async function cancelBookingBySystem(
  repositories: Repositories,
  organizationId: string,
  bookingId: string,
  now: Date,
  reason: string,
): Promise<Booking> {
  const actor: Actor = { type: "system", organizationId };
  const { booking, event } = await lockBooking(repositories, organizationId, bookingId);
  return cancelLocked(repositories, actor, booking, event, now, reason);
}

/** Annulation par le client lui-même, jusqu'au début de l'événement ou de la location. */
async function cancelByCustomer(
  repositories: Repositories,
  organizationId: string,
  bookingId: string,
  now: Date,
): Promise<Booking> {
  const actor: Actor = { type: "customer", organizationId };
  const { booking, event } = await lockBooking(repositories, organizationId, bookingId);
  const startsAt = event?.startsAt ?? booking.rentalStartsAt;
  if (startsAt && startsAt <= now) {
    throw new ConflictError(
      event
        ? "L'événement a commencé : contacte l'organisateur pour annuler"
        : "La location a commencé : contacte l'organisateur pour annuler",
    );
  }
  return cancelLocked(repositories, actor, booking, event, now, "customer_request");
}

/** Annulation par le client depuis son lien « Gérer ma réservation », jusqu'au début de l'événement. */
export async function cancelBookingWithToken(
  deps: Deps,
  organizationId: string,
  manageToken: string,
): Promise<Booking> {
  const tokenHash = await hashToken(manageToken);
  return deps.uow.run(async (repositories) => {
    const found = await repositories.bookings.findByManageTokenHash(organizationId, tokenHash);
    if (!found) throw new NotFoundError("Réservation", "lien");
    return cancelByCustomer(repositories, organizationId, found.id, deps.clock.now());
  });
}

/**
 * Espace client : une réservation n'appartient au client connecté que si sa fiche, dans cet
 * espace, porte son e-mail. Sinon, elle n'existe pas pour lui.
 */
async function findOwnBooking(
  repositories: Repositories,
  organizationId: string,
  bookingId: string,
  email: string,
): Promise<Booking> {
  const booking = await repositories.bookings.find(organizationId, bookingId);
  const customer = booking
    ? await repositories.customers.find(organizationId, booking.customerId)
    : null;
  if (!booking || customer?.email?.toLowerCase() !== email.toLowerCase()) {
    throw new NotFoundError("Réservation", bookingId);
  }
  // Une séance d'une inscription au trimestre ne s'annule ni ne se déplace : on signale l'absence.
  if (booking.enrollmentId) {
    throw new ConflictError(
      "Cette séance fait partie de ton inscription : signale plutôt ton absence",
    );
  }
  return booking;
}

/** Annulation depuis l'espace client (maquette 8.3). */
export async function cancelBookingAsCustomer(
  deps: Deps,
  organizationId: string,
  bookingId: string,
  email: string,
): Promise<Booking> {
  return deps.uow.run(async (repositories) => {
    await findOwnBooking(repositories, organizationId, bookingId, email);
    return cancelByCustomer(repositories, organizationId, bookingId, deps.clock.now());
  });
}

/**
 * Changer de date depuis l'espace client (maquette 8.3) : la réservation passe sur une autre
 * date du même type qui a assez de places, dans le délai d'annulation gratuite. Le prix suit la
 * nouvelle date (reste à payer ou trop-perçu, voir `reschedulePricing`).
 * La place quittée est libérée et profite à la liste d'attente. Les deux événements sont
 * verrouillés dans un ordre fixe (pas d'interblocage entre deux échanges croisés).
 */
export async function rescheduleBookingAsCustomer(
  deps: Deps,
  organizationId: string,
  bookingId: string,
  email: string,
  targetEventId: string,
): Promise<Booking> {
  const actor: Actor = { type: "customer", organizationId };
  return deps.uow.run(async (repositories) => {
    const found = await findOwnBooking(repositories, organizationId, bookingId, email);
    if (!found.eventId) throw new ConflictError("Une location ne change pas de date ici");
    const locks = new Map<string, { event: Event; eventType: EventType }>();
    for (const eventId of [found.eventId, targetEventId].sort()) {
      const locked = await repositories.events.lockForBooking(organizationId, eventId);
      if (locked) locks.set(eventId, locked);
    }
    const booking = await repositories.bookings.find(organizationId, bookingId);
    const from = booking?.eventId ? locks.get(booking.eventId)?.event : undefined;
    const to = locks.get(targetEventId);
    if (!booking || !from) throw new NotFoundError("Réservation", bookingId);
    if (!to) throw new NotFoundError("Événement", targetEventId);

    const now = deps.clock.now();
    const settings = await repositories.settings.get(organizationId);
    const issue =
      rescheduleClosedReason({
        status: booking.status,
        startsAt: from.startsAt,
        now,
        freeCancellationHours: cancellationPolicyOf(from.modules, settings).freeCancellationHours,
      }) ??
      rescheduleTargetIssue({
        from,
        to: {
          ...to.event,
          seatsHeld: await repositories.bookings.seatsHeld(to.event.id),
          minAdvanceHours: to.event.modules.opening?.closesHoursBefore,
        },
        seats: booking.seats,
        now,
      });
    if (issue) throw new ConflictError(issue);

    const status = to.event.requiresApproval ? "pending" : "confirmed";
    const pricing = reschedulePricing({
      booking,
      to: to.event,
      paidCents: paidCents(await repositories.payments.listForBooking(booking.id)),
    });
    const { dueCents, overpaidCents, ...newPrice } = pricing;
    const moved = await repositories.bookings.moveToEvent(organizationId, booking.id, {
      eventId: to.event.id,
      status,
      confirmedAt: status === "confirmed" ? (booking.confirmedAt ?? now) : null,
      ...newPrice,
    });
    // Le matériel attribué au comptoir pour l'ancienne date y retourne.
    await repositories.inventory.releaseBookingAllocations(organizationId, booking.id);
    await reserveEquipment(
      repositories,
      actor,
      to.event,
      booking.id,
      booking.seats,
      [],
      true,
      optionNeedSeats(to.event, booking.seats, moved.priceLines),
    );
    await repositories.activity.record({
      organizationId,
      entityType: "booking",
      entityId: booking.id,
      action: "booking.rescheduled",
      ...actorRef(actor),
      data: {
        fromEventId: from.id,
        toEventId: to.event.id,
        status,
        fromAmountCents: booking.amountCents,
        toAmountCents: pricing.amountCents,
        dueCents,
        overpaidCents,
      },
    });
    await promoteWaitlist(repositories, from, actor, now);
    return moved;
  });
}
