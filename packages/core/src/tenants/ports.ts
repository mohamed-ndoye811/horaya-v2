import type { TenantSector } from "./workspace";

export interface TenantBranding {
  brandColor: string;
  sector: TenantSector;
}

/** Réglages d'un tenant, stockés à côté de l'organisation Better Auth. */
export interface TenantSettingsRepository {
  /** Crée la ligne de réglages avec les valeurs par défaut si elle n'existe pas. */
  ensureExists(organizationId: string): Promise<void>;
  saveBranding(organizationId: string, branding: TenantBranding): Promise<void>;
}

/** Annuaire des espaces (adresses publiques). */
export interface WorkspaceDirectory {
  isSlugTaken(slug: string): Promise<boolean>;
}
