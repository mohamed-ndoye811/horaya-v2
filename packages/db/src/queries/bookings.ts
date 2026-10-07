import { and, count, eq } from "drizzle-orm";
import type { Executor } from "../client";
import { booking } from "../schema";

/**
 * Lectures pour l'affichage (listes, compteurs) : pas de règle métier ici,
 * les écritures passent par les cas d'usage du core.
 */
export async function countPendingBookings(db: Executor, organizationId: string): Promise<number> {
  const [row] = await db
    .select({ value: count() })
    .from(booking)
    .where(and(eq(booking.organizationId, organizationId), eq(booking.status, "pending")));
  return row?.value ?? 0;
}
