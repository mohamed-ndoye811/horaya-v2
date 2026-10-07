import {
  ConflictError,
  type InventoryRepository,
  type Item,
  type ItemAllocation,
  type ItemUnit,
} from "@horaya/core";
import { and, asc, eq, gt, inArray, isNull, lt, ne, type SQL } from "drizzle-orm";
import type { Executor } from "../client";
import { item, itemAllocation, itemType, itemUnit } from "../schema";

/** Exemplaire déjà pris (contrainte d'exclusion) ou référence en double. */
function translateConflict(error: unknown): never {
  const code =
    (error as { cause?: { code?: string } }).cause?.code ?? (error as { code?: string }).code;
  if (code === "23P01") throw new ConflictError("Un exemplaire est déjà pris sur cette période");
  if (code === "23505") throw new ConflictError("Cette référence est déjà utilisée");
  throw error;
}

export function inventoryRepository(db: Executor): InventoryRepository {
  return {
    async lockItem(organizationId, itemId) {
      const [found] = await db
        .select()
        .from(item)
        .where(and(eq(item.organizationId, organizationId), eq(item.id, itemId)))
        .for("update");
      if (!found) return null;
      const units = await db
        .select({
          id: itemUnit.id,
          itemId: itemUnit.itemId,
          label: itemUnit.label,
          status: itemUnit.status,
        })
        .from(itemUnit)
        .where(eq(itemUnit.itemId, itemId))
        .orderBy(asc(itemUnit.createdAt));
      return { item: found as Item, units: units as ItemUnit[] };
    },

    async referenceExists(organizationId, reference, exceptItemId) {
      const [found] = await db
        .select({ id: item.id })
        .from(item)
        .where(
          and(
            eq(item.organizationId, organizationId),
            eq(item.reference, reference),
            exceptItemId ? ne(item.id, exceptItemId) : undefined,
          ),
        )
        .limit(1);
      return Boolean(found);
    },

    async upsertItemType(organizationId, name) {
      const [row] = await db
        .insert(itemType)
        .values({ organizationId, name })
        .onConflictDoUpdate({
          target: [itemType.organizationId, itemType.name],
          set: { archivedAt: null },
        })
        .returning({ id: itemType.id });
      if (!row) throw new Error("Type de matériel non enregistré");
      return row.id;
    },

    async insertItem(values) {
      const [created] = await db.insert(item).values(values).returning().catch(translateConflict);
      return created as Item;
    },

    async updateItem(organizationId, itemId, patch) {
      const [updated] = await db
        .update(item)
        .set(patch)
        .where(and(eq(item.organizationId, organizationId), eq(item.id, itemId)))
        .returning()
        .catch(translateConflict);
      if (!updated) throw new Error(`Article introuvable : ${itemId}`);
      return updated as Item;
    },

    async insertUnits(organizationId, itemId, labels) {
      if (labels.length === 0) return [];
      const rows = await db
        .insert(itemUnit)
        .values(labels.map((label) => ({ organizationId, itemId, label })))
        .returning({
          id: itemUnit.id,
          itemId: itemUnit.itemId,
          label: itemUnit.label,
          status: itemUnit.status,
        });
      return rows as ItemUnit[];
    },

    async setUnitStatus(organizationId, unitIds, status) {
      if (unitIds.length === 0) return;
      await db
        .update(itemUnit)
        .set({ status })
        .where(and(eq(itemUnit.organizationId, organizationId), inArray(itemUnit.id, unitIds)));
    },

    async activeAllocations(unitIds, period) {
      if (unitIds.length === 0) return [];
      const rows = await db
        .select()
        .from(itemAllocation)
        .where(
          and(
            inArray(itemAllocation.itemUnitId, unitIds),
            isNull(itemAllocation.cancelledAt),
            gt(itemAllocation.endsAt, period.startsAt),
            period.endsAt ? lt(itemAllocation.startsAt, period.endsAt) : undefined,
          ),
        )
        .orderBy(asc(itemAllocation.startsAt));
      return rows as ItemAllocation[];
    },

    async insertAllocations(allocations) {
      if (allocations.length === 0) return [];
      const rows = await db
        .insert(itemAllocation)
        .values(allocations)
        .returning()
        .catch(translateConflict);
      return rows as ItemAllocation[];
    },

    async cancelAllocations(organizationId, filter, at) {
      const conditions: Array<SQL | undefined> = [
        eq(itemAllocation.organizationId, organizationId),
        isNull(itemAllocation.cancelledAt),
        filter.eventId ? eq(itemAllocation.eventId, filter.eventId) : undefined,
        filter.bookingId ? eq(itemAllocation.bookingId, filter.bookingId) : undefined,
        filter.allocationIds ? inArray(itemAllocation.id, filter.allocationIds) : undefined,
        filter.itemId
          ? inArray(
              itemAllocation.itemUnitId,
              db
                .select({ id: itemUnit.id })
                .from(itemUnit)
                .where(eq(itemUnit.itemId, filter.itemId)),
            )
          : undefined,
      ];
      const rows = await db
        .update(itemAllocation)
        .set({ cancelledAt: at })
        .where(and(...conditions))
        .returning({ id: itemAllocation.id });
      return rows.length;
    },

    async moveEventAllocations(organizationId, eventId, period) {
      await db
        .update(itemAllocation)
        .set({ startsAt: period.startsAt, endsAt: period.endsAt })
        .where(
          and(
            eq(itemAllocation.organizationId, organizationId),
            eq(itemAllocation.eventId, eventId),
            isNull(itemAllocation.cancelledAt),
          ),
        )
        .catch((error: unknown) => {
          const code = (error as { cause?: { code?: string } }).cause?.code;
          if (code === "23P01") {
            throw new ConflictError(
              "Le matériel réservé pour cet événement n'est pas libre sur les nouvelles dates",
            );
          }
          throw error;
        });
    },

    async findAllocation(organizationId, allocationId) {
      const [row] = await db
        .select({ allocation: itemAllocation, itemId: itemUnit.itemId })
        .from(itemAllocation)
        .innerJoin(itemUnit, eq(itemUnit.id, itemAllocation.itemUnitId))
        .where(
          and(
            eq(itemAllocation.organizationId, organizationId),
            eq(itemAllocation.id, allocationId),
          ),
        );
      return row ? { ...(row.allocation as ItemAllocation), itemId: row.itemId } : null;
    },
  };
}
