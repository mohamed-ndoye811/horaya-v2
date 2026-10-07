import type { Event } from "../events/model";

/** Montant d'une réservation et acompte éventuel, en centimes. */
export function priceBooking(
  event: Pick<Event, "priceCents" | "paymentMode" | "depositPercent">,
  seats: number,
): { amountCents: number; depositCents: number | null } {
  const amountCents = event.priceCents * seats;
  const depositCents =
    event.paymentMode === "deposit" && event.depositPercent !== null
      ? Math.round((amountCents * event.depositPercent) / 100)
      : null;
  return { amountCents, depositCents };
}
