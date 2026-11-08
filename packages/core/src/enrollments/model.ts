import type { PriceLine } from "../bookings/pricing";
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
  /** Prix payé : celui de la série, au prorata des séances restantes si la série le prévoit. */
  amountCents: number;
  currency: string;
  /** Stage : le tarif choisi (une ligne) ; vide pour une série. */
  priceLines: PriceLine[];
  /** Paiement noté par l'équipe (lien externe, sur place). */
  paidAt: Date | null;
  source: BookingSource;
  cancelledAt: Date | null;
  createdAt: Date;
}
