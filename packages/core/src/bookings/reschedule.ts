import type { Event } from "../events/model";
import type { EventStatus, EventVisibility, PaymentMode } from "../events/types";
import { amountDueOnline } from "../payments/rules";
import { remainingSeats } from "./capacity";
import type { Booking } from "./model";
import {
  adjustmentsFromLines,
  type PriceLine,
  quoteBooking,
  selectionFor,
  selectionFromLines,
} from "./pricing";
import type { BookingPaymentStatus, BookingStatus } from "./types";

/**
 * Changer de date (espace client, maquette 8.3) : vers une autre date du même type
 * d'événement qui a assez de places, et seulement dans le délai d'annulation gratuite de
 * l'espace. Le prix peut différer : voir `reschedulePricing`.
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
  if (now.getTime() >= to.startsAt.getTime() - (to.minAdvanceHours ?? 0) * 3_600_000)
    return "Les réservations sont closes pour cette date";
  const remaining = remainingSeats(to.capacity, to.seatsHeld);
  if (remaining !== null && remaining < seats)
    return remaining === 0
      ? "Cette date est complète"
      : `Il ne reste que ${remaining} place${remaining > 1 ? "s" : ""} à cette date`;
  return null;
}

/**
 * Prix de la réservation une fois sur la nouvelle date. Plus cher : ce qui manque apparaît en
 * reste à payer (`dueCents`, la réservation repasse « à payer » si elle était réglée). Moins
 * cher : rien n'est remboursé tout seul, le trop-perçu (`overpaidCents`) est signalé à l'équipe.
 * Payée avec une carte de séances : une séance vaut une séance, rien ne change.
 * Les tarifs et options choisis suivent (ceux que la nouvelle date n'a plus tombent au défaut) ;
 * une réservation d'avant le lot 35 (sans détail) prend le tarif par défaut de la nouvelle date.
 */
export function reschedulePricing(input: {
  booking: Pick<
    Booking,
    "seats" | "amountCents" | "depositCents" | "paymentMode" | "paymentStatus" | "priceLines"
  >;
  to: Pick<Event, "priceCents" | "paymentMode" | "modules">;
  /** Encaissé sur la réservation, remboursements déduits. */
  paidCents: number;
}): {
  amountCents: number;
  depositCents: number | null;
  priceLines: PriceLine[];
  paymentMode: PaymentMode;
  paymentStatus: BookingPaymentStatus;
  dueCents: number;
  overpaidCents: number;
} {
  const { booking, to, paidCents } = input;
  if (booking.paymentStatus === "paid_with_pass") {
    return {
      amountCents: booking.amountCents,
      depositCents: booking.depositCents,
      priceLines: booking.priceLines,
      paymentMode: booking.paymentMode,
      paymentStatus: booking.paymentStatus,
      dueCents: 0,
      overpaidCents: 0,
    };
  }
  const selection = selectionFor(to, booking.seats, selectionFromLines(booking.priceLines));
  // Les réductions des règles suivent l'inscription (le passage à un tarif est déjà dans son choix).
  const { lines, amountCents, depositCents } = quoteBooking(
    to,
    booking.seats,
    selection,
    adjustmentsFromLines(booking.priceLines),
  );
  const priced = { amountCents, depositCents, paymentMode: to.paymentMode };
  const dueCents = amountDueOnline(priced, paidCents);
  return {
    ...priced,
    priceLines: lines,
    paymentStatus:
      booking.paymentStatus === "paid" && dueCents > 0 ? "none" : booking.paymentStatus,
    dueCents,
    overpaidCents: Math.max(0, paidCents - amountCents),
  };
}
