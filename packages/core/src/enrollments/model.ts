import type { BookingSource } from "../bookings/types";

/**
 * Inscription d'un client à toute une série (cours à l'année, au trimestre) : un seul
 * paiement, et une réservation par séance restante (`booking.enrollmentId`).
 */
export interface Enrollment {
  id: string;
  organizationId: string;
  seriesId: string;
  customerId: string;
  /** Prix de la série au moment de l'inscription. */
  amountCents: number;
  currency: string;
  /** Paiement noté par l'équipe (lien externe, sur place). */
  paidAt: Date | null;
  source: BookingSource;
  cancelledAt: Date | null;
  createdAt: Date;
}
