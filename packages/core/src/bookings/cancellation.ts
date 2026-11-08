/** Dans le délai d'annulation gratuite : au plus tard `freeCancellationHours` avant le début (0 = aucun délai gratuit). */
export function isWithinFreeCancellation(input: {
  startsAt: Date;
  now: Date;
  freeCancellationHours: number;
}): boolean {
  if (input.freeCancellationHours <= 0) return false;
  return input.now.getTime() <= input.startsAt.getTime() - input.freeCancellationHours * 3_600_000;
}
