import type { PaymentKind, PaymentMethod, PaymentRecordStatus } from "../bookings/types";

/** Un mouvement d'argent d'une réservation : paiement, acompte, solde ou remboursement. */
export interface PaymentRecord {
  id: string;
  organizationId: string;
  bookingId: string;
  kind: PaymentKind;
  status: PaymentRecordStatus;
  amountCents: number;
  currency: string;
  provider: string;
  /** Paiement (PaymentIntent) ou remboursement chez le prestataire. */
  providerReference: string | null;
  /** Page de paiement (session Checkout) qui a donné ce paiement. */
  checkoutReference: string | null;
  /** Paiement noté à la main : espèces, carte, chèque ou virement (si précisé). */
  method: PaymentMethod | null;
  createdAt: Date;
}

export type NewPaymentRecord = Omit<PaymentRecord, "id" | "createdAt" | "method"> & {
  method?: PaymentMethod | null;
};
