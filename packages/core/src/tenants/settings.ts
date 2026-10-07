import type { TenantSettingsPatch } from "./settings-schemas";

/** Réglages utiles aux cas d'usage (lus dans la transaction en cours). */
export interface TenantSettingsSnapshot {
  timezone: string;
  currency: string;
  bookingReferencePrefix: string;
}

export interface TenantSettingsReader {
  get(organizationId: string): Promise<TenantSettingsSnapshot>;
}

/** Lecture et mise à jour des réglages, dans la transaction en cours. */
export interface TenantSettingsStore extends TenantSettingsReader {
  update(organizationId: string, patch: TenantSettingsPatch): Promise<void>;
}
