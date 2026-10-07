import type { PaymentMode } from "../events/types";
import type { BookingKind, BookingPaymentStatus, BookingSource, BookingStatus } from "./types";

export interface Booking {
  id: string;
  organizationId: string;
  reference: string;
  kind: BookingKind;
  eventId: string | null;
  customerId: string;
  seats: number;
  status: BookingStatus;
  amountCents: number;
  currency: string;
  paymentMode: PaymentMode;
  paymentStatus: BookingPaymentStatus;
  depositCents: number | null;
  customerMessage: string | null;
  refusalReason: string | null;
  source: BookingSource;
  /** Location de matériel seule : période louée. */
  rentalStartsAt: Date | null;
  rentalEndsAt: Date | null;
  confirmedAt: Date | null;
  cancelledAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface ParticipantInput {
  firstName: string;
  lastName: string;
  email: string | null;
  customAnswers: Record<string, string | boolean>;
}

export interface CustomerContact {
  firstName: string;
  lastName: string;
  email: string;
  phone: string | null;
  company: string | null;
}
