import type { Booking, CustomerContact } from "../bookings/model";
import { customerContactSchema } from "../bookings/schemas";
import { type Actor, actorRef, assertMemberCan } from "../shared/actor";
import { ConflictError, ForbiddenError, NotFoundError } from "../shared/errors";
import type { Deps, Repositories } from "../shared/unit-of-work";
import { validate } from "../shared/validate";
import type { Pass, PassPlan } from "./model";
import { isRecreditDue, passAcceptsEventType, passExpiry } from "./rules";
import {
  type AdjustPassInput,
  adjustPassSchema,
  type PassPlanInput,
  type PayWithPassInput,
  passPlanSchema,
  payWithPassSchema,
  type SellPassInput,
  sellPassSchema,
} from "./schemas";

/* ---------- Formules ---------- */

export async function createPassPlan(
  deps: Deps,
  actor: Actor,
  input: PassPlanInput,
): Promise<PassPlan> {
  assertMemberCan(actor, "settings", "update");
  const data = validate(passPlanSchema, input);
  return deps.uow.run((repositories) => repositories.passes.insertPlan(actor.organizationId, data));
}

export async function updatePassPlan(
  deps: Deps,
  actor: Actor,
  planId: string,
  input: PassPlanInput,
): Promise<PassPlan> {
  assertMemberCan(actor, "settings", "update");
  const data = validate(passPlanSchema, input);
  return deps.uow.run(async (repositories) => {
    if (!(await repositories.passes.findPlan(actor.organizationId, planId))) {
      throw new NotFoundError("Formule de carte", planId);
    }
    return repositories.passes.updatePlan(actor.organizationId, planId, data);
  });
}

/** Archivée, une formule n'est plus proposée à la vente ; les cartes déjà vendues restent valables. */
export async function setPassPlanArchived(
  deps: Deps,
  actor: Actor,
  planId: string,
  archived: boolean,
): Promise<PassPlan> {
  assertMemberCan(actor, "settings", "update");
  return deps.uow.run(async (repositories) => {
    if (!(await repositories.passes.findPlan(actor.organizationId, planId))) {
      throw new NotFoundError("Formule de carte", planId);
    }
    return repositories.passes.updatePlan(actor.organizationId, planId, {
      archivedAt: archived ? deps.clock.now() : null,
    });
  });
}

/* ---------- Vente ---------- */

async function newPass(
  repositories: Repositories,
  actor: Actor,
  customerId: string,
  planId: string,
): Promise<Pass> {
  const plan = await repositories.passes.findPlan(actor.organizationId, planId);
  if (!plan || plan.archivedAt) throw new NotFoundError("Formule de carte", planId);
  const pass = await repositories.passes.insert({
    organizationId: actor.organizationId,
    customerId,
    planId: plan.id,
    name: plan.name,
    sessionsTotal: plan.sessions,
    priceCents: plan.priceCents,
    validityDays: plan.validityDays,
    eventTypeIds: plan.eventTypeIds,
    status: "pending",
    source: actor.type === "member" ? "admin" : "public_page",
  });
  await repositories.activity.record({
    organizationId: actor.organizationId,
    entityType: "pass",
    entityId: pass.id,
    action: "pass.created",
    ...actorRef(actor),
    data: { customerId },
  });
  return pass;
}

/** Paiement reçu : la carte devient active (une seule fois), avec son solde et sa date de fin. */
async function activate(
  repositories: Repositories,
  actor: Actor,
  pass: Pass,
  now: Date,
  paymentMethod: Pass["paymentMethod"],
): Promise<Pass> {
  if (pass.status !== "pending") throw new ConflictError("Cette carte est déjà active");
  const activated = await repositories.passes.update(actor.organizationId, pass.id, {
    status: "active",
    activatedAt: now,
    expiresAt: passExpiry(now, pass.validityDays),
    paymentMethod,
  });
  await repositories.passes.insertMovement({
    organizationId: actor.organizationId,
    passId: pass.id,
    kind: "purchase",
    delta: pass.sessionsTotal,
    bookingId: null,
    reason: null,
    actorType: actor.type,
  });
  await repositories.activity.record({
    organizationId: actor.organizationId,
    entityType: "pass",
    entityId: pass.id,
    action: "pass.activated",
    ...actorRef(actor),
    data: { sessions: pass.sessionsTotal },
  });
  return activated;
}

/** Vente au comptoir : client existant, formule, et paiement noté tout de suite ou plus tard. */
export async function sellPass(deps: Deps, actor: Actor, input: SellPassInput): Promise<Pass> {
  assertMemberCan(actor, "booking", "create");
  const data = validate(sellPassSchema, input);
  return deps.uow.run(async (repositories) => {
    const customer = await repositories.customers.find(actor.organizationId, data.customerId);
    if (!customer || customer.archivedAt || customer.anonymizedAt) {
      throw new NotFoundError("Client", data.customerId);
    }
    const pass = await newPass(repositories, actor, customer.id, data.planId);
    return data.paid
      ? activate(repositories, actor, pass, deps.clock.now(), data.paymentMethod ?? null)
      : pass;
  });
}

/** Achat sur la page publique : la carte attend que l'organisateur la marque payée. */
export async function purchasePassPublic(
  deps: Deps,
  organizationId: string,
  input: { planId: string; customer: CustomerContact },
): Promise<Pass> {
  const contact = validate(customerContactSchema, input.customer);
  const actor: Actor = { type: "customer", organizationId };
  return deps.uow.run(async (repositories) => {
    const customer = await repositories.customers.upsertByEmail(organizationId, contact);
    return newPass(repositories, actor, customer.id, input.planId);
  });
}

/** « Marquer comme payée » : la carte devient active. */
export async function markPassPaid(
  deps: Deps,
  actor: Actor,
  passId: string,
  paymentMethod: Pass["paymentMethod"] = null,
): Promise<Pass> {
  assertMemberCan(actor, "booking", "update");
  return deps.uow.run(async (repositories) => {
    const pass = await repositories.passes.lock(actor.organizationId, passId);
    if (!pass) throw new NotFoundError("Carte", passId);
    return activate(repositories, actor, pass, deps.clock.now(), paymentMethod);
  });
}

/** Vente jamais payée : on l'annule (rien n'a été débité, rien à recréditer). */
export async function cancelPendingPass(deps: Deps, actor: Actor, passId: string): Promise<void> {
  assertMemberCan(actor, "booking", "update");
  await deps.uow.run(async (repositories) => {
    const pass = await repositories.passes.lock(actor.organizationId, passId);
    if (!pass) throw new NotFoundError("Carte", passId);
    if (pass.status !== "pending") throw new ConflictError("Seule une carte non payée s'annule");
    await repositories.passes.update(actor.organizationId, passId, { status: "cancelled" });
  });
}

/** Ajustement manuel motivé : une ligne de plus dans le journal, le solde ne descend jamais sous 0. */
export async function adjustPass(
  deps: Deps,
  actor: Actor,
  passId: string,
  input: AdjustPassInput,
): Promise<void> {
  assertMemberCan(actor, "booking", "update");
  const data = validate(adjustPassSchema, input);
  await deps.uow.run(async (repositories) => {
    const pass = await repositories.passes.lock(actor.organizationId, passId);
    if (!pass) throw new NotFoundError("Carte", passId);
    if (pass.status !== "active") throw new ConflictError("Seule une carte active s'ajuste");
    if ((await repositories.passes.balance(pass.id)) + data.delta < 0) {
      throw new ConflictError("Le solde ne peut pas devenir négatif");
    }
    await repositories.passes.insertMovement({
      organizationId: actor.organizationId,
      passId,
      kind: "adjustment",
      delta: data.delta,
      bookingId: null,
      reason: data.reason,
      actorType: actor.type,
    });
    await repositories.activity.record({
      organizationId: actor.organizationId,
      entityType: "pass",
      entityId: passId,
      action: "pass.adjusted",
      ...actorRef(actor),
      data: { delta: data.delta },
    });
  });
}

/* ---------- Utilisation ---------- */

/**
 * Débite la carte d'une séance par place, pour une réservation. À appeler avec le verrou de
 * l'événement déjà pris (même ordre que les annulations : événement, puis carte). La carte
 * est verrouillée : deux réservations simultanées ne consomment jamais la même séance.
 */
export async function payBookingWithPassIn(
  repositories: Repositories,
  actor: Actor,
  booking: Booking,
  passId: string,
  now: Date,
): Promise<Booking> {
  if (booking.status !== "pending" && booking.status !== "confirmed") {
    throw new ConflictError("Cette réservation n'est pas active");
  }
  if (booking.paymentStatus !== "none" && booking.paymentStatus !== "failed") {
    throw new ConflictError("Cette réservation est déjà réglée");
  }
  if (booking.kind !== "event" || !booking.eventId || booking.amountCents <= 0) {
    throw new ConflictError("Il n'y a rien à régler avec une carte sur cette réservation");
  }
  const event = await repositories.events.find(booking.organizationId, booking.eventId);
  if (!event) throw new NotFoundError("Événement", booking.eventId);
  const pass = await repositories.passes.lock(booking.organizationId, passId);
  if (!pass || pass.customerId !== booking.customerId) throw new NotFoundError("Carte", passId);
  if (pass.status !== "active") throw new ConflictError("Cette carte n'est pas active");
  if (!pass.expiresAt || pass.expiresAt <= now) throw new ConflictError("Cette carte a expiré");
  if (!passAcceptsEventType(pass, event.eventTypeId)) {
    throw new ConflictError("Cette carte ne s'utilise pas pour ce type d'événement");
  }
  const balance = await repositories.passes.balance(pass.id);
  if (balance < booking.seats) {
    throw new ConflictError(
      `Solde insuffisant : ${balance} séance${balance > 1 ? "s" : ""} pour ${booking.seats} place${booking.seats > 1 ? "s" : ""}`,
    );
  }
  await repositories.passes.insertMovement({
    organizationId: booking.organizationId,
    passId,
    kind: "use",
    delta: -booking.seats,
    bookingId: booking.id,
    reason: null,
    actorType: actor.type,
  });
  await repositories.bookings.updatePaymentStatus(
    booking.organizationId,
    booking.id,
    "paid_with_pass",
  );
  await repositories.activity.record({
    organizationId: booking.organizationId,
    entityType: "pass",
    entityId: passId,
    action: "pass.used",
    ...actorRef(actor),
    data: { bookingId: booking.id, seats: booking.seats, balance: balance - booking.seats },
  });
  await repositories.activity.record({
    organizationId: booking.organizationId,
    entityType: "booking",
    entityId: booking.id,
    action: "booking.paid_with_pass",
    ...actorRef(actor),
    data: { passId, seats: booking.seats },
  });
  return { ...booking, paymentStatus: "paid_with_pass" };
}

async function payWithPass(
  deps: Deps,
  actor: Actor,
  input: PayWithPassInput,
  customerId: string | null,
): Promise<Booking> {
  const data = validate(payWithPassSchema, input);
  return deps.uow.run(async (repositories) => {
    const found = await repositories.bookings.find(actor.organizationId, data.bookingId);
    if (!found || (customerId && found.customerId !== customerId)) {
      throw new NotFoundError("Réservation", data.bookingId);
    }
    // Même ordre de verrous que les annulations : l'événement d'abord, la carte ensuite.
    if (found.eventId)
      await repositories.events.lockForBooking(actor.organizationId, found.eventId);
    const booking = await repositories.bookings.find(actor.organizationId, data.bookingId);
    if (!booking) throw new NotFoundError("Réservation", data.bookingId);
    return payBookingWithPassIn(repositories, actor, booking, data.passId, deps.clock.now());
  });
}

/** Par l'équipe, sur une réservation existante (fiche réservation). */
export function payBookingWithPass(
  deps: Deps,
  actor: Actor,
  input: PayWithPassInput,
): Promise<Booking> {
  assertMemberCan(actor, "booking", "update");
  return payWithPass(deps, actor, input, null);
}

/**
 * Par le client lui-même, connecté à son espace (lot 29) : `customerId` vient de la session
 * du client, jamais d'un formulaire. Il ne peut régler que ses réservations avec ses cartes.
 */
export function payBookingWithPassAsCustomer(
  deps: Deps,
  identity: { organizationId: string; customerId: string },
  input: PayWithPassInput,
): Promise<Booking> {
  if (!identity.customerId) throw new ForbiddenError();
  return payWithPass(
    deps,
    { type: "customer", organizationId: identity.organizationId },
    input,
    identity.customerId,
  );
}

/**
 * Annulation (ou refus) d'une réservation payée avec une carte : rend les séances si dû
 * (voir isRecreditDue), une seule fois. À appeler sous le verrou de l'événement.
 */
export async function recreditPassForBooking(
  repositories: Repositories,
  actor: Actor,
  booking: Booking,
  startsAt: Date | null,
  now: Date,
): Promise<boolean> {
  if (booking.paymentStatus !== "paid_with_pass") return false;
  const used = await repositories.passes.findMovementForBooking(booking.id, "use");
  if (!used) return false;
  const { freeCancellationHours } = await repositories.settings.get(booking.organizationId);
  if (
    !isRecreditDue({ byCustomer: actor.type === "customer", startsAt, now, freeCancellationHours })
  ) {
    return false;
  }
  await repositories.passes.lock(booking.organizationId, used.passId);
  if (await repositories.passes.findMovementForBooking(booking.id, "recredit")) return false;
  await repositories.passes.insertMovement({
    organizationId: booking.organizationId,
    passId: used.passId,
    kind: "recredit",
    delta: -used.delta,
    bookingId: booking.id,
    reason: null,
    actorType: actor.type,
  });
  await repositories.bookings.updatePaymentStatus(booking.organizationId, booking.id, "none");
  await repositories.activity.record({
    organizationId: booking.organizationId,
    entityType: "pass",
    entityId: used.passId,
    action: "pass.recredited",
    ...actorRef(actor),
    data: { bookingId: booking.id, seats: -used.delta },
  });
  return true;
}
