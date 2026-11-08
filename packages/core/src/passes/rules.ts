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
 * La séance est rendue à l'annulation : toujours quand c'est l'organisateur (ou le système)
 * qui annule, et pour le client seulement dans le délai d'annulation gratuite de l'espace.
 */
export function isRecreditDue(input: {
  byCustomer: boolean;
  startsAt: Date | null;
  now: Date;
  freeCancellationHours: number;
}): boolean {
  if (!input.byCustomer || !input.startsAt) return true;
  if (input.freeCancellationHours <= 0) return false;
  return input.now.getTime() <= input.startsAt.getTime() - input.freeCancellationHours * 3_600_000;
}
