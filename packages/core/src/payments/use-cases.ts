import { cancelBookingBySystem } from "../bookings/use-cases";
import { type Actor, actorRef, assertMemberCan } from "../shared/actor";
import { ConflictError, NotFoundError } from "../shared/errors";
import type { Deps } from "../shared/unit-of-work";
import type { StripeAccountStatus } from "../tenants/types";
import type { PaymentGateway } from "./ports";
import { amountDueOnline, awaitsOnlinePayment, paidCents, refundForCancellation } from "./rules";

/** Dépendances des cas d'usage de paiement : les habituelles, plus la passerelle. */
export type PaymentDeps = Deps & { payments: PaymentGateway };

/** Durée de vie d'une page de paiement (minimum Stripe : 30 minutes). */
const CHECKOUT_MINUTES = 30;

/** Paramètres › Paiements : crée le compte de l'organisateur si besoin et renvoie son lien d'activation. */
export async function connectPaymentAccount(
  deps: PaymentDeps,
  actor: Actor,
  input: { email: string; businessName: string; returnUrl: string; refreshUrl: string },
): Promise<{ url: string }> {
  assertMemberCan(actor, "billing", "manage");
  const settings = await deps.uow.run((repositories) =>
    repositories.settings.get(actor.organizationId),
  );
  let accountId = settings.paymentAccountId;
  if (!accountId) {
    ({ accountId } = await deps.payments.createAccount({
      email: input.email,
      businessName: input.businessName,
    }));
    const created = accountId;
    await deps.uow.run((repositories) =>
      repositories.settings.setPaymentAccount(actor.organizationId, created, "pending"),
    );
  }
  return deps.payments.createOnboardingLink({
    accountId,
    returnUrl: input.returnUrl,
    refreshUrl: input.refreshUrl,
  });
}

/** Relit l'état du compte chez le prestataire (retour d'activation, webhook « account.updated »). */
export async function refreshPaymentAccount(
  deps: PaymentDeps,
  organizationId: string,
): Promise<StripeAccountStatus> {
  const settings = await deps.uow.run((repositories) => repositories.settings.get(organizationId));
  if (!settings.paymentAccountId) return "not_connected";
  const { status } = await deps.payments.getAccount(settings.paymentAccountId);
  const accountId = settings.paymentAccountId;
  if (status !== settings.paymentAccountStatus) {
    await deps.uow.run((repositories) =>
      repositories.settings.setPaymentAccount(organizationId, accountId, status),
    );
  }
  return status;
}

/**
 * Ouvre la page de paiement d'une réservation confirmée qui attend son paiement en ligne
 * (tout ou l'acompte). Le paiement est noté « en attente » jusqu'au retour du prestataire.
 */
export async function startCheckout(
  deps: PaymentDeps,
  organizationId: string,
  bookingId: string,
  input: { description: string; successUrl: string; cancelUrl: string },
): Promise<{ url: string }> {
  const { booking, customerEmail, accountId } = await deps.uow.run(async (repositories) => {
    const found = await repositories.bookings.find(organizationId, bookingId);
    if (!found) throw new NotFoundError("Réservation", bookingId);
    if (!awaitsOnlinePayment(found))
      throw new ConflictError("Cette réservation n'a rien à payer en ligne");
    const settings = await repositories.settings.get(organizationId);
    if (!settings.paymentAccountId || settings.paymentAccountStatus !== "active") {
      throw new ConflictError(
        "Le paiement en ligne n'est pas encore disponible pour cet organisateur",
      );
    }
    const customer = await repositories.customers.find(organizationId, found.customerId);
    return {
      booking: found,
      customerEmail: customer?.email ?? "",
      accountId: settings.paymentAccountId,
    };
  });

  const amountCents = amountDueOnline(booking);
  const checkout = await deps.payments.createCheckout({
    accountId,
    bookingId: booking.id,
    reference: booking.reference,
    description: input.description,
    amountCents,
    currency: booking.currency,
    customerEmail,
    successUrl: input.successUrl,
    cancelUrl: input.cancelUrl,
    expiresAt: new Date(deps.clock.now().getTime() + CHECKOUT_MINUTES * 60_000),
  });
  await deps.uow.run(async (repositories) => {
    // Une nouvelle page de paiement remplace les précédentes restées ouvertes.
    for (const previous of await repositories.payments.listForBooking(booking.id)) {
      if (previous.status === "pending") await repositories.payments.markFailed(previous.id);
    }
    await repositories.payments.insert({
      organizationId,
      bookingId: booking.id,
      kind: booking.paymentMode === "deposit" ? "deposit" : "charge",
      status: "pending",
      amountCents,
      currency: booking.currency,
      provider: deps.payments.provider,
      providerReference: null,
      checkoutReference: checkout.checkoutId,
    });
  });
  return { url: checkout.url };
}

/** Paiement réussi (webhook) : idempotent, un même événement peut arriver deux fois. */
export async function completeCheckout(
  deps: Deps,
  provider: string,
  checkoutReference: string,
  paymentReference: string,
): Promise<void> {
  await deps.uow.run(async (repositories) => {
    const payment = await repositories.payments.findByCheckout(provider, checkoutReference);
    if (!payment) throw new NotFoundError("Paiement", checkoutReference);
    if (payment.status === "succeeded") return;
    await repositories.payments.markSucceeded(payment.id, paymentReference);
    await repositories.bookings.updatePaymentStatus(
      payment.organizationId,
      payment.bookingId,
      "paid",
    );
    await repositories.activity.record({
      organizationId: payment.organizationId,
      entityType: "booking",
      entityId: payment.bookingId,
      action: "booking.paid",
      ...actorRef({ type: "system", organizationId: payment.organizationId }),
      data: { amountCents: payment.amountCents, kind: payment.kind },
    });
  });
}

/**
 * Page de paiement expirée ou abandonnée (webhook) : une réservation faite en ligne et
 * jamais payée est annulée, ses places reviennent aux autres (et à la liste d'attente).
 */
export async function expireCheckout(
  deps: Deps,
  provider: string,
  checkoutReference: string,
): Promise<void> {
  await deps.uow.run(async (repositories) => {
    const payment = await repositories.payments.findByCheckout(provider, checkoutReference);
    if (!payment || payment.status !== "pending") return;
    await repositories.payments.markFailed(payment.id);
    const booking = await repositories.bookings.find(payment.organizationId, payment.bookingId);
    if (booking && booking.source === "public_page" && awaitsOnlinePayment(booking)) {
      const pending = (await repositories.payments.listForBooking(booking.id)).some(
        (other) => other.id !== payment.id && other.status === "pending",
      );
      // Une autre tentative de paiement est en cours : on la laisse aboutir.
      if (!pending)
        await cancelBookingBySystem(
          repositories,
          booking.organizationId,
          booking.id,
          deps.clock.now(),
          "payment_expired",
        );
    }
  });
}

/**
 * Remboursement chez le prestataire, plafonné à ce qui a été encaissé.
 * Par l'équipe (droit « booking.refund ») ou automatique après une annulation.
 */
export async function refundBooking(
  deps: PaymentDeps,
  actor: Actor,
  bookingId: string,
  requestedCents?: number,
): Promise<number> {
  if (actor.type === "member") assertMemberCan(actor, "booking", "refund");
  if (actor.type === "customer") throw new ConflictError("Remboursement réservé à l'organisateur");
  const { charge, amountCents, accountId } = await deps.uow.run(async (repositories) => {
    const booking = await repositories.bookings.find(actor.organizationId, bookingId);
    if (!booking) throw new NotFoundError("Réservation", bookingId);
    const payments = await repositories.payments.listForBooking(bookingId);
    const paid = paidCents(payments);
    const settings = await repositories.settings.get(actor.organizationId);
    const charge = payments.find(
      (payment) =>
        payment.kind !== "refund" && payment.status === "succeeded" && payment.providerReference,
    );
    return {
      charge,
      amountCents: Math.min(paid, requestedCents ?? paid),
      accountId: settings.paymentAccountId,
    };
  });
  if (amountCents <= 0) return 0;
  if (!charge?.providerReference || !accountId)
    throw new ConflictError("Aucun paiement en ligne à rembourser");

  const { refundId } = await deps.payments.refund({
    accountId,
    paymentReference: charge.providerReference,
    amountCents,
  });
  await deps.uow.run(async (repositories) => {
    await repositories.payments.insert({
      organizationId: actor.organizationId,
      bookingId,
      kind: "refund",
      status: "succeeded",
      amountCents,
      currency: charge.currency,
      provider: deps.payments.provider,
      providerReference: refundId,
      checkoutReference: null,
    });
    const remaining = paidCents(await repositories.payments.listForBooking(bookingId));
    await repositories.bookings.updatePaymentStatus(
      actor.organizationId,
      bookingId,
      remaining > 0 ? "partially_refunded" : "refunded",
    );
    await repositories.activity.record({
      organizationId: actor.organizationId,
      entityType: "booking",
      entityId: bookingId,
      action: "booking.refunded",
      ...actorRef(actor),
      data: { amountCents },
    });
  });
  return amountCents;
}

/** Après une annulation : rembourse selon la politique de l'espace (ou tout si l'organisateur annule). */
export async function refundAfterCancellation(
  deps: PaymentDeps,
  organizationId: string,
  bookingId: string,
  cancelledBy: "customer" | "organizer",
): Promise<number> {
  const amount = await deps.uow.run(async (repositories) => {
    const booking = await repositories.bookings.find(organizationId, bookingId);
    if (!booking) return 0;
    const [payments, settings, event] = await Promise.all([
      repositories.payments.listForBooking(bookingId),
      repositories.settings.get(organizationId),
      booking.eventId ? repositories.events.find(organizationId, booking.eventId) : null,
    ]);
    return refundForCancellation({
      paidCents: paidCents(payments),
      cancelledBy,
      startsAt: event?.startsAt ?? booking.rentalStartsAt,
      now: deps.clock.now(),
      policy: settings,
    });
  });
  if (amount <= 0) return 0;
  return refundBooking(deps, { type: "system", organizationId }, bookingId, amount);
}
