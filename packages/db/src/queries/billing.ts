import { eq } from "drizzle-orm";
import type { Executor } from "../client";
import { billing, planGrant } from "../schema";

/**
 * Remet la facturation d'un espace à zéro (ni abonnement, ni licence, tarif standard).
 * Réservé à l'aperçu « Voir en tant que » des postes de développement.
 */
export async function resetBilling(db: Executor, organizationId: string): Promise<void> {
  await db.delete(planGrant).where(eq(planGrant.organizationId, organizationId));
  await db.delete(billing).where(eq(billing.organizationId, organizationId));
}
