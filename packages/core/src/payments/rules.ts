import type { Booking } from "../bookings/model";
import type { PaymentRecord } from "./model";

/** Ce que le client paie en ligne en réservant : tout (paiement en ligne) ou l'acompte. */
export function amountDueOnline(
  booking: Pick<Booking, "paymentMode" | "amountCents" | "depositCents">,
): number {
  if (booking.paymentMode === "online") return booking.amountCents;
  if (booking.paymentMode === "deposit") return booking.depositCents ?? booking.amountCents;
  return 0;
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

/** Une réservation confirmée qui attend encore son paiement en ligne. */
export function awaitsOnlinePayment(
  booking: Pick<
    Booking,
    "status" | "paymentMode" | "paymentStatus" | "amountCents" | "depositCents"
  >,
): boolean {
  return (
    booking.status === "confirmed" &&
    amountDueOnline(booking) > 0 &&
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
