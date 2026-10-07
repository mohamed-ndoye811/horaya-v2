import type { TenantSettingsRepository } from "@horaya/core";
import type { Db } from "../client";
import { tenantSettings } from "../schema";

export function tenantSettingsRepository(db: Db): TenantSettingsRepository {
  return {
    async ensureExists(organizationId) {
      await db.insert(tenantSettings).values({ organizationId }).onConflictDoNothing();
    },

    async saveBranding(organizationId, { brandColor, sector }) {
      await db
        .insert(tenantSettings)
        .values({ organizationId, brandColor, sector })
        .onConflictDoUpdate({
          target: tenantSettings.organizationId,
          set: { brandColor, sector, updatedAt: new Date() },
        });
    },
  };
}
