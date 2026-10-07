import { type ActivityEntry, refundAfterCancellation } from "@horaya/core";
import { paymentDeps } from ".";

/**
 * Effets de paiement après une transaction : une réservation payée qui est annulée est
 * remboursée (selon la politique si c'est le client, entièrement si c'est l'organisateur).
 */
export async function paymentEffects(entries: ActivityEntry[]) {
  for (const entry of entries) {
    if (entry.entityType !== "booking" || entry.action !== "booking.cancelled") continue;
    if (entry.data?.reason === "payment_expired") continue;
    try {
      await refundAfterCancellation(
        paymentDeps,
        entry.organizationId,
        entry.entityId,
        entry.actorType === "customer" ? "customer" : "organizer",
      );
    } catch (error) {
      console.error("Remboursement automatique impossible", entry.entityId, error);
    }
  }
}
