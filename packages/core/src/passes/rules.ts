import { isWithinFreeCancellation } from "../bookings/cancellation";
import type { Pass, PassMovement } from "./model";

/** Le solde est la somme du journal : jamais un compteur modifié à la main. */
export function passBalance(movements: ReadonlyArray<Pick<PassMovement, "delta">>): number {
  return movements.reduce((total, movement) => total + movement.delta, 0);
}

export function passExpiry(activatedAt: Date, validityDays: number): Date {
  return new Date(activatedAt.getTime() + validityDays * 86_400_000);
}

export type PassState = "pending" | "active" | "expired" | "exhausted" | "cancelled";

export function passState(
  pass: Pick<Pass, "status" | "expiresAt">,
  balance: number,
  now: Date,
): PassState {
  if (pass.status !== "active") return pass.status;
  if (pass.expiresAt && pass.expiresAt <= now) return "expired";
  return balance <= 0 ? "exhausted" : "active";
}

export function passAcceptsEventType(pass: Pick<Pass, "eventTypeIds">, eventTypeId: string) {
  return pass.eventTypeIds.length === 0 || pass.eventTypeIds.includes(eventTypeId);
}

/**
 * Une carte ne règle une séance que si celle-ci a lieu avant la fin de sa validité : c'est la
 * date de la séance qui compte, pas celle du débit.
 */
export function passValidForSession(pass: Pick<Pass, "expiresAt">, sessionStartsAt: Date): boolean {
  return pass.expiresAt !== null && sessionStartsAt < pass.expiresAt;
}

/**
 * Qui annule, et donc si la séance est rendue :
 * - `customer` : seulement dans le délai d'annulation gratuite de l'espace ;
 * - `always` : toujours (l'atelier annule l'événement entier, refuse une demande, ou le système annule) ;
 * - `team` : l'équipe annule une seule réservation, elle décide (`teamChoice`) ; sans choix,
 *   la séance est rendue dans le délai d'annulation gratuite, pas après.
 */
export type RecreditCause = "customer" | "always" | "team";

export function isRecreditDue(input: {
  cause: RecreditCause;
  teamChoice?: boolean | undefined;
  startsAt: Date | null;
  now: Date;
  freeCancellationHours: number;
}): boolean {
  if (input.cause === "always" || !input.startsAt) return true;
  if (input.cause === "team" && input.teamChoice !== undefined) return input.teamChoice;
  return isWithinFreeCancellation({ ...input, startsAt: input.startsAt });
}
