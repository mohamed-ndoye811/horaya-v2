import type { Period } from "./availability";
import type { Item, ItemAllocation, ItemUnit, NewAllocation } from "./model";
import type { ItemUnitStatus } from "./types";

export type NewItem = Omit<Item, "id" | "archivedAt" | "photoUrl">;
export type ItemPatch = Partial<Omit<Item, "id" | "organizationId">>;

export interface AllocationFilter {
  eventId?: string;
  bookingId?: string;
  itemId?: string;
  allocationIds?: string[];
}

export interface InventoryRepository {
  /**
   * Charge l'article et ses exemplaires en le verrouillant (SELECT … FOR UPDATE) :
   * deux affectations simultanées du même article se font l'une après l'autre.
   */
  lockItem(
    organizationId: string,
    itemId: string,
  ): Promise<{ item: Item; units: ItemUnit[] } | null>;
  referenceExists(
    organizationId: string,
    reference: string,
    exceptItemId?: string,
  ): Promise<boolean>;
  upsertItemType(organizationId: string, name: string): Promise<string>;
  insertItem(item: NewItem): Promise<Item>;
  updateItem(organizationId: string, itemId: string, patch: ItemPatch): Promise<Item>;
  insertUnits(organizationId: string, itemId: string, labels: string[]): Promise<ItemUnit[]>;
  setUnitStatus(organizationId: string, unitIds: string[], status: ItemUnitStatus): Promise<void>;
  /** Allocations actives des exemplaires, qui chevauchent la période (ou qui finissent après `period.startsAt` si `period.endsAt` est absent). */
  activeAllocations(
    unitIds: string[],
    period: Period | { startsAt: Date; endsAt?: undefined },
  ): Promise<ItemAllocation[]>;
  /** Lève une ConflictError si un exemplaire est déjà pris (contrainte d'exclusion). */
  insertAllocations(allocations: NewAllocation[]): Promise<ItemAllocation[]>;
  cancelAllocations(organizationId: string, filter: AllocationFilter, at: Date): Promise<number>;
  /** Décale les allocations d'un événement sur ses nouvelles dates (ConflictError si conflit). */
  moveEventAllocations(organizationId: string, eventId: string, period: Period): Promise<void>;
  findAllocation(
    organizationId: string,
    allocationId: string,
  ): Promise<(ItemAllocation & { itemId: string }) | null>;
}
