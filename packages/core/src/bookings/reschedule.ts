import type { EventStatus, EventVisibility, PaymentMode } from "../events/types";
import { remainingSeats } from "./capacity";
import type { BookingStatus } from "./types";

/**
 * Changer de date (espace client, maquette 8.3) : vers une autre date du même type
 * d'événement, au même prix, qui a assez de places, et seulement dans le délai d'annulation
 * gratuite de l'espace.
 */

/** Dernier moment pour changer de date : le délai d'annulation gratuite avant le début. */
export function rescheduleDeadline(startsAt: Date, freeCancellationHours: number): Date {
  return new Date(startsAt.getTime() - Math.max(0, freeCancellationHours) * 3_600_000);
}

/** Pourquoi la réservation ne peut plus changer de date, ou null si elle le peut. */
export function rescheduleClosedReason(input: {
  status: BookingStatus;
  startsAt: Date;
  now: Date;
  freeCancellationHours: number;
}): string | null {
  if (input.status !== "confirmed" && input.status !== "pending")
    return "Cette réservation ne peut pas changer de date";
  if (input.now >= rescheduleDeadline(input.startsAt, input.freeCancellationHours))
    return "Le délai pour changer de date est passé : contacte l'organisateur";
  return null;
}

export interface RescheduleSource {
  id: string;
  eventTypeId: string;
  priceCents: number;
  paymentMode: PaymentMode;
}

export interface RescheduleTarget extends RescheduleSource {
  status: EventStatus;
  visibility: EventVisibility;
  startsAt: Date;
  capacity: number | null;
  seatsHeld: number;
  /** Délai minimum avant le début pour réserver en ligne (règles du type), en heures. */
  minAdvanceHours?: number | undefined;
}

/** Pourquoi cette date n'est pas proposée, ou null si on peut y passer. */
export function rescheduleTargetIssue(input: {
  from: RescheduleSource;
  to: RescheduleTarget;
  seats: number;
  now: Date;
}): string | null {
  const { from, to, seats, now } = input;
  if (to.id === from.id) return "C'est déjà la date de ta réservation";
  if (
    to.eventTypeId !== from.eventTypeId ||
    to.status !== "published" ||
    to.visibility !== "public"
  )
    return "Cette date n'est pas proposée";
  // Même prix et même mode de paiement : ce qui a été payé reste juste.
  if (to.priceCents !== from.priceCents || to.paymentMode !== from.paymentMode)
    return "Cette date n'a pas le même tarif";
  if (now.getTime() >= to.startsAt.getTime() - (to.minAdvanceHours ?? 0) * 3_600_000)
    return "Les réservations sont closes pour cette date";
  const remaining = remainingSeats(to.capacity, to.seatsHeld);
  if (remaining !== null && remaining < seats)
    return remaining === 0
      ? "Cette date est complète"
      : `Il ne reste que ${remaining} place${remaining > 1 ? "s" : ""} à cette date`;
  return null;
}
