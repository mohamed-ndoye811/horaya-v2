import type { Event } from "../events/model";
import { type Actor, actorRef } from "../shared/actor";
import type { Repositories } from "../shared/unit-of-work";
import { remainingSeats } from "./capacity";
import type { Booking } from "./model";

/**
 * Fait monter la liste d'attente dès que des places se libèrent, dans l'ordre des demandes.
 * Une demande trop grande pour les places restantes est passée, sans bloquer les suivantes.
 * À appeler sous le verrou de l'événement.
 */
export async function promoteWaitlist(
  repositories: Repositories,
  event: Event,
  actor: Actor,
  now: Date,
): Promise<Booking[]> {
  if (event.status !== "published") return [];

  let held = await repositories.bookings.seatsHeld(event.id);
  const promoted: Booking[] = [];

  for (const candidate of await repositories.bookings.listWaitlisted(event.id)) {
    const remaining = remainingSeats(event.capacity, held);
    if (remaining === 0) break;
    if (remaining !== null && candidate.seats > remaining) continue;

    const status = event.requiresApproval ? "pending" : "confirmed";
    const updated = await repositories.bookings.updateStatus(event.organizationId, candidate.id, {
      status,
      confirmedAt: status === "confirmed" ? now : null,
    });
    held += candidate.seats;
    promoted.push(updated);
    await repositories.activity.record({
      organizationId: event.organizationId,
      entityType: "booking",
      entityId: candidate.id,
      action: "booking.promoted",
      ...actorRef(actor),
      data: { status },
    });
  }
  return promoted;
}
