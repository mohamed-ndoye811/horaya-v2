import { sql } from "drizzle-orm";
import { event, tenantSettings } from "../schema";

/**
 * Délai d'annulation gratuite d'une réservation : celui du module Annulation copié sur
 * l'événement, sinon celui de la structure (même règle que cancellationPolicyOf du core).
 * La requête doit joindre `event` et `tenant_settings`.
 */
export const freeCancellationHoursSql = sql<number>`coalesce((${event.modules}->'cancellation'->>'freeHours')::int, ${tenantSettings.freeCancellationHours}, 72)`;
