import type { StripeAccountStatus } from "../tenants/types";
import type { NewPaymentRecord, PaymentRecord } from "./model";

/**
 * Prestataire de paiement (Stripe Connect) : chaque organisateur encaisse sur son propre
 * compte, Horaya n'est que la plateforme. Une passerelle de test simule tout sans clés.
 */
export interface PaymentGateway {
  readonly provider: string;
  createAccount(input: { email: string; businessName: string }): Promise<{ accountId: string }>;
  /** Lien d'activation du compte (identité, IBAN…), chez le prestataire. */
  createOnboardingLink(input: {
    accountId: string;
    returnUrl: string;
    refreshUrl: string;
  }): Promise<{ url: string }>;
  getAccount(
    accountId: string,
  ): Promise<{ status: StripeAccountStatus; displayName: string | null }>;
  createCheckout(input: {
    accountId: string;
    bookingId: string;
    reference: string;
    description: string;
    amountCents: number;
    currency: string;
    customerEmail: string;
    successUrl: string;
    cancelUrl: string;
    expiresAt: Date;
  }): Promise<{ checkoutId: string; url: string }>;
  refund(input: {
    accountId: string;
    paymentReference: string;
    amountCents: number;
  }): Promise<{ refundId: string }>;
  /** Solde et prochain virement ; null si le prestataire ne les fournit pas. */
  getBalance(accountId: string): Promise<{
    availableCents: number;
    pendingCents: number;
    nextPayoutAt: Date | null;
    nextPayoutCents: number | null;
  } | null>;
}

export interface PaymentRepository {
  insert(record: NewPaymentRecord): Promise<PaymentRecord>;
  findByCheckout(provider: string, checkoutReference: string): Promise<PaymentRecord | null>;
  markSucceeded(paymentId: string, providerReference: string): Promise<PaymentRecord>;
  markFailed(paymentId: string): Promise<void>;
  listForBooking(bookingId: string): Promise<PaymentRecord[]>;
}
