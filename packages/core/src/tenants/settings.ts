/** Réglages utiles aux cas d'usage (lus dans la transaction en cours). */
export interface TenantSettingsSnapshot {
  timezone: string;
  currency: string;
  bookingReferencePrefix: string;
}

export interface TenantSettingsReader {
  get(organizationId: string): Promise<TenantSettingsSnapshot>;
}
