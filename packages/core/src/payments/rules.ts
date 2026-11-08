import type { Booking } from "../bookings/model";
import type { PaymentRecord } from "./model";

/** Ce que le client paie en ligne en réservant : tout (paiement en ligne) ou l'acompte. */
export function amountDueOnline(
  booking: Pick<Booking, "paymentMode" | "amountCents" | "depositCents">,
  /** Déjà réglé (bon cadeau, paiement noté) : retiré de ce qui reste à payer. */
  alreadyPaidCents = 0,
): number {
  const due =
    booking.paymentMode === "online"
      ? booking.amountCents
      : booking.paymentMode === "deposit"
        ? (booking.depositCents ?? booking.amountCents)
        : 0;
  return Math.max(0, due - alreadyPaidCents);
}

/** Montant encaissé, remboursements déduits. */
export function paidCents(
  payments: ReadonlyArray<Pick<PaymentRecord, "kind" | "status" | "amountCents">>,
): number {
  return payments
    .filter((payment) => payment.status === "succeeded")
    .reduce(
      (total, payment) =>
        total + (payment.kind === "refund" ? -payment.amountCents : payment.amountCents),
      0,
    );
}

/** Montant encaissé chez le prestataire ou noté à la main : les bons cadeaux n'y sont pas. */
export function externalPaidCents(
  payments: ReadonlyArray<Pick<PaymentRecord, "kind" | "status" | "amountCents" | "method">>,
): number {
  return paidCents(payments.filter((payment) => payment.method !== "gift_card"));
}

/** Une réservation confirmée qui attend encore son paiement en ligne. */
export function awaitsOnlinePayment(
  booking: Pick<
    Booking,
    "status" | "paymentMode" | "paymentStatus" | "amountCents" | "depositCents"
  >,
  alreadyPaidCents = 0,
): boolean {
  return (
    booking.status === "confirmed" &&
    amountDueOnline(booking, alreadyPaidCents) > 0 &&
    (booking.paymentStatus === "none" || booking.paymentStatus === "failed")
  );
}

/**
 * Remboursement dû à l'annulation d'une réservation payée.
 * L'organisateur qui annule rembourse tout ; le client est remboursé en entier jusqu'au délai
 * d'annulation gratuite, puis selon le pourcentage choisi dans les paramètres.
 */
export function refundForCancellation(input: {
  paidCents: number;
  cancelledBy: "customer" | "organizer";
  startsAt: Date | null;
  now: Date;
  policy: { freeCancellationHours: number; lateCancellationRefundPercent: number };
}): number {
  if (input.paidCents <= 0) return 0;
  if (input.cancelledBy === "organizer" || !input.startsAt) return input.paidCents;
  const deadline = input.startsAt.getTime() - input.policy.freeCancellationHours * 3_600_000;
  if (input.policy.freeCancellationHours > 0 && input.now.getTime() <= deadline)
    return input.paidCents;
  return Math.round((input.paidCents * input.policy.lateCancellationRefundPercent) / 100);
}
