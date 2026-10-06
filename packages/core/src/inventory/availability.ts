import { ValidationError } from "../shared/errors";
import type { ItemUnitStatus } from "./types";

/** Période semi-ouverte [startsAt, endsAt) : finir à 12h et recommencer à 12h ne se chevauche pas. */
export type Period = { startsAt: Date; endsAt: Date };

export type UnitSnapshot = { id: string; status: ItemUnitStatus };

export type AllocationSnapshot = Period & {
  itemUnitId: string;
  cancelledAt: Date | null;
};

export function assertValidPeriod(period: Period): void {
  if (!(period.endsAt.getTime() > period.startsAt.getTime())) {
    throw new ValidationError("La fin doit être après le début", [
      { path: "endsAt", message: "Doit être postérieure au début" },
    ]);
  }
}

export function periodsOverlap(a: Period, b: Period): boolean {
  return a.startsAt.getTime() < b.endsAt.getTime() && b.startsAt.getTime() < a.endsAt.getTime();
}

/**
 * Exemplaires libres sur une période : en service et sans allocation active qui chevauche.
 * Miroir applicatif de la contrainte d'exclusion Postgres `item_allocation_no_overlap`,
 * qui reste la garantie finale en cas d'écritures concurrentes.
 */
export function freeUnits(
  units: readonly UnitSnapshot[],
  allocations: readonly AllocationSnapshot[],
  period: Period,
): UnitSnapshot[] {
  assertValidPeriod(period);
  const busy = new Set(
    allocations
      .filter((allocation) => allocation.cancelledAt === null && periodsOverlap(allocation, period))
      .map((allocation) => allocation.itemUnitId),
  );
  return units.filter((unit) => unit.status === "available" && !busy.has(unit.id));
}
