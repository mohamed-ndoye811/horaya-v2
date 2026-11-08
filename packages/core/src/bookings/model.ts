import type { PaymentMode } from "../events/types";
import type { FieldValues } from "../fields/model";
import type { BookingKind, BookingPaymentStatus, BookingSource, BookingStatus } from "./types";

export interface Booking {
  id: string;
  organizationId: string;
  reference: string;
  kind: BookingKind;
  eventId: string | null;
  /** Réservation créée par une inscription à une série (cours à l'année). */
  enrollmentId: string | null;
  customerId: string;
  seats: number;
  status: BookingStatus;
  amountCents: number;
  currency: string;
  paymentMode: PaymentMode;
  paymentStatus: BookingPaymentStatus;
  depositCents: number | null;
  customerMessage: string | null;
  /** Réponses aux questions « une fois par inscription ». */
  answers: FieldValues;
  refusalReason: string | null;
  source: BookingSource;
  /** Location de matériel seule : période louée. */
  rentalStartsAt: Date | null;
  rentalEndsAt: Date | null;
  confirmedAt: Date | null;
  cancelledAt: Date | null;
  /** Arrivée pointée le jour J, pour toute la réservation. */
  checkedInAt: Date | null;
  /** Absence signalée sur une séance d'une inscription : la place a été libérée. */
  absentAt: Date | null;
  /** Absence signalée à temps : la séance est à rattraper (voir enrollments/rules). */
  makeupEligible: boolean;
  /** Rattrapage : l'absence (réservation annulée d'une inscription) que cette séance remplace. */
  makeupForBookingId: string | null;
  createdAt: Date;
  updatedAt: Date;
}

/** Une ligne par place ; le nom peut rester vide (« Participant 2 »). */
export interface ParticipantInput {
  firstName: string;
  lastName: string;
  email: string | null;
  /** Réponses aux questions « pour chaque participant ». */
  answers: FieldValues;
}

export interface CustomerContact {
  firstName: string;
  lastName: string;
  email: string;
  phone: string | null;
  company: string | null;
}
