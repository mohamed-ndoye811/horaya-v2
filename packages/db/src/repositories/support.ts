import type {
  ActivityLog,
  CustomerRepository,
  ReferenceCounter,
  TenantSettingsReader,
} from "@horaya/core";
import { eq, sql } from "drizzle-orm";
import { v7 as uuidv7 } from "uuid";
import type { Executor } from "../client";
import { activityLog, customer, referenceCounter, tenantSettings } from "../schema";

export function customerRepository(db: Executor): CustomerRepository {
  return {
    async upsertByEmail(organizationId, contact) {
      // Conflit sur l'index unique (organization_id, lower(email)) : on garde la fiche
      // existante telle quelle (l'équipe a pu la corriger) et on renvoie son identifiant.
      // Drizzle ne sait pas viser un index sur expression : requête SQL paramétrée.
      const rows = await db.execute<{ id: string }>(sql`
        insert into ${customer} (id, organization_id, first_name, last_name, email, phone, company)
        values (${uuidv7()}, ${organizationId}, ${contact.firstName}, ${contact.lastName},
                ${contact.email}, ${contact.phone}, ${contact.company})
        on conflict (organization_id, lower(email)) do update set updated_at = now()
        returning id`);
      const row = rows[0];
      if (!row) throw new Error("Client non enregistré");
      return { id: row.id };
    },
  };
}

export function referenceCounterRepository(db: Executor): ReferenceCounter {
  return {
    async next(organizationId, scope, period) {
      const [row] = await db
        .insert(referenceCounter)
        .values({ organizationId, scope, period, value: 1 })
        .onConflictDoUpdate({
          target: [
            referenceCounter.organizationId,
            referenceCounter.scope,
            referenceCounter.period,
          ],
          set: { value: sql`${referenceCounter.value} + 1` },
        })
        .returning({ value: referenceCounter.value });
      if (!row) throw new Error("Compteur indisponible");
      return row.value;
    },
  };
}

export function activityLogRepository(db: Executor): ActivityLog {
  return {
    async record(entry) {
      await db.insert(activityLog).values(entry);
    },
  };
}

export function tenantSettingsReader(db: Executor): TenantSettingsReader {
  return {
    async get(organizationId) {
      const [row] = await db
        .select({
          timezone: tenantSettings.timezone,
          currency: tenantSettings.currency,
          bookingReferencePrefix: tenantSettings.bookingReferencePrefix,
        })
        .from(tenantSettings)
        .where(eq(tenantSettings.organizationId, organizationId));
      // Espace sans ligne de réglages (créé hors parcours) : valeurs par défaut.
      return row ?? { timezone: "Europe/Paris", currency: "EUR", bookingReferencePrefix: "HRY" };
    },
  };
}
