import { ConflictError, ValidationError } from "../shared/errors";
import type { BookingStatus } from "./types";

/** Statuts qui occupent réellement des places (la liste d'attente n'en occupe pas). */
export const SEAT_HOLDING_STATUSES: ReadonlySet<BookingStatus> = new Set(["pending", "confirmed"]);

export type PlacementInput = {
  /** null = places illimitées. */
  capacity: number | null;
  /** Places déjà occupées (réservations en attente + confirmées). */
  seatsHeld: number;
  seatsRequested: number;
  requiresApproval: boolean;
  waitlistEnabled: boolean;
};

export function remainingSeats(capacity: number | null, seatsHeld: number): number | null {
  if (capacity === null) return null;
  return Math.max(0, capacity - seatsHeld);
}

/**
 * Décide du statut d'une nouvelle réservation sur un événement.
 * L'appelant doit avoir verrouillé l'événement (SELECT … FOR UPDATE) pour que
 * `seatsHeld` ne bouge pas entre la lecture et l'écriture : c'est ce qui garantit
 * qu'il n'y a jamais de surréservation, même avec des demandes simultanées.
 */
export function decideBookingStatus(input: PlacementInput): BookingStatus {
  const { capacity, seatsHeld, seatsRequested, requiresApproval, waitlistEnabled } = input;

  if (!Number.isInteger(seatsRequested) || seatsRequested <= 0) {
    throw new ValidationError("Le nombre de places doit être un entier positif", [
      { path: "seats", message: "Doit être supérieur à 0" },
    ]);
  }

  const remaining = remainingSeats(capacity, seatsHeld);
  const fits = remaining === null || seatsRequested <= remaining;

  if (!fits) {
    if (waitlistEnabled) return "waitlisted";
    throw new ConflictError(
      remaining === 0
        ? "Cet événement est complet"
        : `Il ne reste que ${remaining} place${remaining > 1 ? "s" : ""}`,
    );
  }

  return requiresApproval ? "pending" : "confirmed";
}
