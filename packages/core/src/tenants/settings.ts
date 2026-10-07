import type { TenantSettingsPatch } from "./settings-schemas";
import type { StripeAccountStatus } from "./types";

/** Réglages utiles aux cas d'usage (lus dans la transaction en cours). */
export interface TenantSettingsSnapshot {
  timezone: string;
  currency: string;
  bookingReferencePrefix: string;
  freeCancellationHours: number;
  lateCancellationRefundPercent: number;
  /** Compte de paiement de l'organisateur (Stripe Connect). */
  paymentAccountId: string | null;
  paymentAccountStatus: StripeAccountStatus;
}

export interface TenantSettingsReader {
  get(organizationId: string): Promise<TenantSettingsSnapshot>;
}

/** Lecture et mise à jour des réglages, dans la transaction en cours. */
export interface TenantSettingsStore extends TenantSettingsReader {
  update(organizationId: string, patch: TenantSettingsPatch): Promise<void>;
  setPaymentAccount(
    organizationId: string,
    accountId: string,
    status: StripeAccountStatus,
  ): Promise<void>;
}
