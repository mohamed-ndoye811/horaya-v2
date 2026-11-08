import type { Booking } from "../bookings/model";
import type { PaymentMethod } from "../bookings/types";
import { paidCents, refundForCancellation } from "../payments/rules";
import { type Actor, actorRef, assertMemberCan } from "../shared/actor";
import { ConflictError, ForbiddenError, NotFoundError, ValidationError } from "../shared/errors";
import { generateToken } from "../shared/tokens";
import type { Deps, Repositories } from "../shared/unit-of-work";
import { validate } from "../shared/validate";
import type { GiftCard, GiftCardSettings } from "./model";
import {
  generateGiftCardCode,
  giftCardAmountError,
  giftCardApplicableCents,
  giftCardBalance,
  giftCardExpiry,
  normalizeGiftCardCode,
} from "./rules";
import {
  type GiftCardSettingsInput,
  giftCardSettingsSchema,
  type PurchaseGiftCardInput,
  purchaseGiftCardSchema,
} from "./schemas";

const MAX_CODE_ATTEMPTS = 8;

export async function updateGiftCardSettings(
  deps: Deps,
  actor: Actor,
  input: GiftCardSettingsInput,
): Promise<GiftCardSettings> {
  assertMemberCan(actor, "settings", "update");
  const settings = validate(giftCardSettingsSchema, input);
  await deps.uow.run((repositories) =>
    repositories.giftCards.setSettings(actor.organizationId, settings),
  );
  return settings;
}

/** Rend le bon actif : échéance, mouvement d'émission. Dans une transaction, bon verrouillé. */
async function activate(repositories: Repositories, actor: Actor, card: GiftCard, now: Date) {
  const settings = await repositories.giftCards.getSettings(card.organizationId);
  const active = await repositories.giftCards.update(card.organizationId, card.id, {
    status: "active",
    paidAt: now,
    expiresAt: giftCardExpiry(now, settings.validityMonths),
  });
  await repositories.giftCards.addMovement({
    organizationId: card.organizationId,
    giftCardId: card.id,
    kind: "issue",
    amountCents: card.initialCents,
    bookingId: null,
    note: null,
  });
  await repositories.activity.record({
    organizationId: card.organizationId,
    entityType: "gift_card",
    entityId: card.id,
    action: "gift_card.activated",
    ...actorRef(actor),
    data: { amountCents: card.initialCents },
  });
  return active;
}

/**
 * Achat d'un bon cadeau : par le visiteur de la page publique (en attente de paiement) ou par
 * l'équipe au comptoir (`paid` : déjà encaissé, actif tout de suite).
 */
export async function purchaseGiftCard(
  deps: Deps,
  actor: Actor,
  input: PurchaseGiftCardInput,
): Promise<GiftCard> {
  if (actor.type === "system") throw new ForbiddenError();
  if (actor.type === "member") assertMemberCan(actor, "giftCard", "create");
  const data = validate(purchaseGiftCardSchema, input);

  return deps.uow.run(async (repositories) => {
    const settings = await repositories.giftCards.getSettings(actor.organizationId);
    if (actor.type === "customer" && !settings.enabled) {
      throw new ConflictError("Cet organisateur ne vend pas de bons cadeaux");
    }
    // L'équipe fixe le montant librement ; les visiteurs suivent les réglages.
    const amountError =
      actor.type === "customer" ? giftCardAmountError(settings, data.amountCents) : null;
    if (amountError) {
      throw new ValidationError(amountError, [{ path: "amountCents", message: amountError }]);
    }
    const name = await repositories.giftCards.organizationName(actor.organizationId);
    const now = deps.clock.now();
    let card: GiftCard | null = null;
    for (let attempt = 0; !card && attempt < MAX_CODE_ATTEMPTS; attempt++) {
      card = await repositories.giftCards.insert({
        organizationId: actor.organizationId,
        code: generateGiftCardCode(name),
        status: "pending",
        initialCents: data.amountCents,
        currency: "EUR",
        purchaserName: data.purchaserName,
        purchaserEmail: data.purchaserEmail,
        recipientName: data.recipientName,
        recipientEmail: data.recipientEmail,
        message: data.message,
        source: actor.type === "member" ? "counter" : "public_page",
        viewToken: generateToken(),
      });
    }
    if (!card) throw new ConflictError("Code de bon indisponible, réessaie");
    await repositories.activity.record({
      organizationId: actor.organizationId,
      entityType: "gift_card",
      entityId: card.id,
      action: "gift_card.purchased",
      ...actorRef(actor),
      data: { amountCents: card.initialCents },
    });
    return actor.type === "member" && data.paid ? activate(repositories, actor, card, now) : card;
  });
}

async function lockedCard(repositories: Repositories, organizationId: string, id: string) {
  const card = await repositories.giftCards.lock(organizationId, id);
  if (!card) throw new NotFoundError("Bon cadeau", id);
  return card;
}

/** « Marquer comme payé » : paiement reçu hors Horaya, le bon devient utilisable. */
export async function markGiftCardPaid(deps: Deps, actor: Actor, giftCardId: string) {
  assertMemberCan(actor, "giftCard", "update");
  return deps.uow.run(async (repositories) => {
    const card = await lockedCard(repositories, actor.organizationId, giftCardId);
    if (card.status !== "pending") throw new ConflictError("Ce bon n'attend pas de paiement");
    return activate(repositories, actor, card, deps.clock.now());
  });
}

/** Annule le bon : ce qui reste du solde est retiré (journal), le bon n'est plus utilisable. */
export async function cancelGiftCard(
  deps: Deps,
  actor: Actor,
  giftCardId: string,
  reason?: string,
) {
  assertMemberCan(actor, "giftCard", "cancel");
  return deps.uow.run(async (repositories) => {
    const card = await lockedCard(repositories, actor.organizationId, giftCardId);
    if (card.status === "cancelled") throw new ConflictError("Ce bon est déjà annulé");
    const balance = giftCardBalance(await repositories.giftCards.listMovements(card.id));
    if (balance > 0) {
      await repositories.giftCards.addMovement({
        organizationId: card.organizationId,
        giftCardId: card.id,
        kind: "cancel",
        amountCents: -balance,
        bookingId: null,
        note: reason?.trim() || null,
      });
    }
    const cancelled = await repositories.giftCards.update(card.organizationId, card.id, {
      status: "cancelled",
      cancelledAt: deps.clock.now(),
    });
    await repositories.activity.record({
      organizationId: card.organizationId,
      entityType: "gift_card",
      entityId: card.id,
      action: "gift_card.cancelled",
      ...actorRef(actor),
      data: { reason: reason ?? null },
    });
    return cancelled;
  });
}

/** Correction du solde par l'équipe (geste commercial, erreur de saisie) ; la raison est obligatoire. */
export async function adjustGiftCard(
  deps: Deps,
  actor: Actor,
  giftCardId: string,
  deltaCents: number,
  note: string,
) {
  assertMemberCan(actor, "giftCard", "update");
  if (!Number.isInteger(deltaCents) || deltaCents === 0) {
    throw new ValidationError("Montant invalide", [
      { path: "amount", message: "Montant invalide" },
    ]);
  }
  if (!note.trim()) {
    throw new ValidationError("Indique la raison", [{ path: "note", message: "Raison requise" }]);
  }
  await deps.uow.run(async (repositories) => {
    const card = await lockedCard(repositories, actor.organizationId, giftCardId);
    if (card.status !== "active") throw new ConflictError("Seul un bon actif peut être ajusté");
    const balance = giftCardBalance(await repositories.giftCards.listMovements(card.id));
    if (balance + deltaCents < 0) throw new ConflictError("Le solde ne peut pas être négatif");
    await repositories.giftCards.addMovement({
      organizationId: card.organizationId,
      giftCardId: card.id,
      kind: "adjust",
      amountCents: deltaCents,
      bookingId: null,
      note: note.trim(),
    });
    await repositories.activity.record({
      organizationId: card.organizationId,
      entityType: "gift_card",
      entityId: card.id,
      action: "gift_card.adjusted",
      ...actorRef(actor),
      data: { amountCents: deltaCents },
    });
  });
}

const invalidCode = () =>
  new ValidationError("Bon cadeau invalide", [
    // Un seul message : on ne dit pas si le code existe, est expiré ou épuisé.
    {
      path: "giftCardCode",
      message: "Ce bon cadeau n'existe pas, est expiré ou n'a plus de solde",
    },
  ]);

/**
 * Utilise un bon sur une réservation (page publique ou comptoir), dans la transaction de la
 * réservation : déduit du bon le montant restant à payer, au plus son solde, et note le
 * paiement. Renvoie ce qui a été déduit.
 */
export async function applyGiftCardToBooking(
  repositories: Repositories,
  actor: Actor,
  booking: Booking,
  rawCode: string,
  now: Date,
): Promise<number> {
  const card = await repositories.giftCards.lockByCode(
    booking.organizationId,
    normalizeGiftCardCode(rawCode),
  );
  if (card?.status !== "active" || !card.expiresAt || card.expiresAt <= now) {
    throw invalidCode();
  }
  const balance = giftCardBalance(await repositories.giftCards.listMovements(card.id));
  if (balance <= 0) throw invalidCode();
  const already = paidCents(await repositories.payments.listForBooking(booking.id));
  const applied = giftCardApplicableCents(balance, booking.amountCents - already);
  if (applied <= 0) return 0;

  await repositories.giftCards.addMovement({
    organizationId: card.organizationId,
    giftCardId: card.id,
    kind: "use",
    amountCents: -applied,
    bookingId: booking.id,
    note: null,
  });
  await repositories.payments.insert({
    organizationId: booking.organizationId,
    bookingId: booking.id,
    kind: "charge",
    status: "succeeded",
    amountCents: applied,
    currency: booking.currency,
    provider: "gift_card",
    providerReference: null,
    checkoutReference: null,
    method: "gift_card" satisfies PaymentMethod,
  });
  if (already + applied >= booking.amountCents) {
    await repositories.bookings.updatePaymentStatus(booking.organizationId, booking.id, "paid");
  }
  await repositories.activity.record({
    organizationId: booking.organizationId,
    entityType: "booking",
    entityId: booking.id,
    action: "booking.gift_card_used",
    ...actorRef(actor),
    data: { amountCents: applied, code: card.code },
  });
  return applied;
}

/**
 * Réservation annulée ou refusée : le montant du bon utilisé est rendu au bon. L'organisateur
 * qui annule rend tout ; le client suit la politique d'annulation de l'espace.
 */
export async function restoreGiftCardForBooking(
  repositories: Repositories,
  booking: Booking,
  cancelledBy: "customer" | "organizer",
  startsAt: Date | null,
  now: Date,
): Promise<void> {
  const movements = await repositories.giftCards.listBookingMovements(booking.id);
  const used = -giftCardBalance(movements);
  const first = movements[0];
  if (!first || used <= 0) return;
  const settings = await repositories.settings.get(booking.organizationId);
  const amount = refundForCancellation({
    paidCents: used,
    cancelledBy,
    startsAt,
    now,
    policy: settings,
  });
  if (amount <= 0) return;
  const card = await repositories.giftCards.lock(booking.organizationId, first.giftCardId);
  if (!card || card.status === "cancelled") return;
  await repositories.giftCards.addMovement({
    organizationId: card.organizationId,
    giftCardId: card.id,
    kind: "restore",
    amountCents: amount,
    bookingId: booking.id,
    note: null,
  });
  await repositories.payments.insert({
    organizationId: booking.organizationId,
    bookingId: booking.id,
    kind: "refund",
    status: "succeeded",
    amountCents: amount,
    currency: booking.currency,
    provider: "gift_card",
    providerReference: null,
    checkoutReference: null,
    method: "gift_card",
  });
}
