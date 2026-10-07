import type { AllocationKind, ItemUnitStatus } from "@horaya/core";
import { and, asc, desc, eq, inArray, isNull, sql } from "drizzle-orm";
import type { Executor } from "../client";
import { item, itemAllocation, itemType, itemUnit } from "../schema";

const iso = (date: Date) => sql`${date.toISOString()}::timestamptz`;
const toDate = (value: unknown): Date | null =>
  value === null || value === undefined ? null : new Date(String(value));

export type ItemTab = "all" | "available" | "out" | "maintenance";

export interface ItemRow {
  id: string;
  name: string;
  reference: string;
  typeName: string | null;
  dailyRateCents: number | null;
  units: number;
  /** Exemplaires en service et libres en ce moment. */
  availableNow: number;
  /** Exemplaires en maintenance en ce moment. */
  inMaintenanceNow: number;
  nextTitle: string | null;
  nextKind: AllocationKind | null;
  nextStartsAt: Date | null;
  nextEndsAt: Date | null;
}

/**
 * Agrégats par article (sous-requêtes corrélées, noms de tables explicites) :
 * exemplaires en service, libres maintenant, en maintenance, prochaine sortie.
 */
function itemAggregates(now: Date) {
  const nowSql = iso(now);
  const activeAllocation = sql`a.cancelled_at is null and a.starts_at <= ${nowSql} and a.ends_at > ${nowSql}`;
  // Prochaine (ou actuelle) sortie : la plus proche qui n'est pas terminée.
  const next = (column: string) =>
    sql.raw(`(select ${column} from item_allocation a
      join item_unit u on u.id = a.item_unit_id
      left join event e on e.id = a.event_id
      left join booking b on b.id = a.booking_id
      left join customer c on c.id = b.customer_id
      where u.item_id = "item"."id" and a.cancelled_at is null and a.ends_at > '${now.toISOString()}'
      order by a.starts_at limit 1)`);
  return {
    units: sql<number>`(select count(*) from item_unit u where u.item_id = "item"."id" and u.status <> 'retired')::int`,
    availableNow: sql<number>`(select count(*) from item_unit u where u.item_id = "item"."id" and u.status = 'available'
      and not exists (select 1 from item_allocation a where a.item_unit_id = u.id and ${activeAllocation}))::int`,
    inMaintenanceNow: sql<number>`(select count(*) from item_unit u where u.item_id = "item"."id" and (u.status = 'maintenance'
      or exists (select 1 from item_allocation a where a.item_unit_id = u.id and a.kind = 'maintenance' and ${activeAllocation})))::int`,
    nextTitle: sql<
      string | null
    >`${next("coalesce(e.title, a.title, c.first_name || ' ' || c.last_name)")}`,
    nextKind: sql<AllocationKind | null>`${next("a.kind")}`,
    nextStartsAt: sql<Date | null>`${next("a.starts_at")}`.mapWith(toDate),
    nextEndsAt: sql<Date | null>`${next("a.ends_at")}`.mapWith(toDate),
  };
}

/** Inventaire (écran 20). */
export async function listItems(
  db: Executor,
  organizationId: string,
  options: { tab: ItemTab; now: Date; search?: string },
): Promise<ItemRow[]> {
  const search = options.search?.trim();
  const rows = (await db
    .select({
      id: item.id,
      name: item.name,
      reference: item.reference,
      typeName: itemType.name,
      dailyRateCents: item.dailyRateCents,
      ...itemAggregates(options.now),
    })
    .from(item)
    .leftJoin(itemType, eq(itemType.id, item.itemTypeId))
    .where(
      and(
        eq(item.organizationId, organizationId),
        isNull(item.archivedAt),
        search
          ? sql`(${item.name} ilike ${`%${search}%`} or ${item.reference} ilike ${`%${search}%`} or ${itemType.name} ilike ${`%${search}%`})`
          : undefined,
      ),
    )
    .orderBy(asc(item.name))) as ItemRow[];

  return rows.filter((row) => {
    if (options.tab === "available") return row.availableNow > 0;
    if (options.tab === "out") return row.availableNow < row.units - row.inMaintenanceNow;
    if (options.tab === "maintenance") return row.inMaintenanceNow > 0;
    return true;
  });
}

/** Bandeau de l'écran 20. */
export async function getInventoryStats(
  db: Executor,
  organizationId: string,
  bounds: { now: Date; dayEnd: Date; monthStart: Date },
) {
  const rows = await db.execute<{
    items: number;
    types: number;
    out_now: number;
    returns_today: number;
    rental_revenue: number;
    maintenance: number;
  }>(sql`
    select
      (select count(*) from item where organization_id = ${organizationId} and archived_at is null)::int as items,
      (select count(distinct item_type_id) from item where organization_id = ${organizationId} and archived_at is null and item_type_id is not null)::int as types,
      (select count(distinct a.item_unit_id) from item_allocation a
        where a.organization_id = ${organizationId} and a.cancelled_at is null and a.kind <> 'maintenance'
        and a.starts_at <= ${iso(bounds.now)} and a.ends_at > ${iso(bounds.now)})::int as out_now,
      (select count(distinct a.item_unit_id) from item_allocation a
        where a.organization_id = ${organizationId} and a.cancelled_at is null and a.kind <> 'maintenance'
        and a.ends_at > ${iso(bounds.now)} and a.ends_at <= ${iso(bounds.dayEnd)})::int as returns_today,
      (select coalesce(sum(amount_cents), 0) from booking
        where organization_id = ${organizationId} and kind = 'rental' and status = 'confirmed'
        and created_at >= ${iso(bounds.monthStart)})::int as rental_revenue,
      (select count(distinct a.item_unit_id) from item_allocation a
        where a.organization_id = ${organizationId} and a.cancelled_at is null and a.kind = 'maintenance'
        and a.ends_at > ${iso(bounds.now)})::int as maintenance`);
  const row = rows[0];
  return {
    items: row?.items ?? 0,
    types: row?.types ?? 0,
    outNow: row?.out_now ?? 0,
    returnsToday: row?.returns_today ?? 0,
    rentalRevenueCents: row?.rental_revenue ?? 0,
    maintenanceUnits: row?.maintenance ?? 0,
  };
}

export interface ItemAllocationRow {
  id: string;
  unitId: string;
  unitLabel: string;
  kind: AllocationKind;
  startsAt: Date;
  endsAt: Date;
  title: string | null;
  provider: string | null;
  costCents: number | null;
  eventId: string | null;
  eventTitle: string | null;
  eventColor: string | null;
  bookingId: string | null;
  customerName: string | null;
  cancelledAt: Date | null;
}

const allocationSelect = {
  id: itemAllocation.id,
  unitId: itemUnit.id,
  unitLabel: itemUnit.label,
  kind: itemAllocation.kind,
  startsAt: itemAllocation.startsAt,
  endsAt: itemAllocation.endsAt,
  title: itemAllocation.title,
  provider: itemAllocation.provider,
  costCents: itemAllocation.costCents,
  eventId: itemAllocation.eventId,
  eventTitle: sql<
    string | null
  >`(select e.title from event e where e.id = "item_allocation"."event_id")`,
  eventColor: sql<
    string | null
  >`(select t.color from event e join event_type t on t.id = e.event_type_id where e.id = "item_allocation"."event_id")`,
  bookingId: itemAllocation.bookingId,
  customerName: sql<
    string | null
  >`(select c.first_name || ' ' || c.last_name from booking b join customer c on c.id = b.customer_id where b.id = "item_allocation"."booking_id")`,
  cancelledAt: itemAllocation.cancelledAt,
};

/** Fiche article (écran 21) : article, exemplaires, planning sur la période, maintenances, chiffres. */
export async function getItemDetail(
  db: Executor,
  organizationId: string,
  itemId: string,
  range: { from: Date; to: Date; now: Date },
) {
  const [row] = await db
    .select({
      id: item.id,
      name: item.name,
      reference: item.reference,
      description: item.description,
      typeName: itemType.name,
      dailyRateCents: item.dailyRateCents,
      depositCents: item.depositCents,
      storageLocation: item.storageLocation,
      purchasedOn: item.purchasedOn,
      purchasePriceCents: item.purchasePriceCents,
      rentable: item.rentable,
      archivedAt: item.archivedAt,
      ...itemAggregates(range.now),
    })
    .from(item)
    .leftJoin(itemType, eq(itemType.id, item.itemTypeId))
    .where(and(eq(item.organizationId, organizationId), eq(item.id, itemId)));
  if (!row) return null;

  const units = (await db
    .select({ id: itemUnit.id, label: itemUnit.label, status: itemUnit.status })
    .from(itemUnit)
    .where(eq(itemUnit.itemId, itemId))
    .orderBy(
      asc(sql`nullif(regexp_replace(${itemUnit.label}, '\\D', '', 'g'), '')::int`),
    )) as Array<{
    id: string;
    label: string;
    status: ItemUnitStatus;
  }>;

  const unitIds = units.map((unit) => unit.id);
  const [planning, maintenance, [totals]] = await Promise.all([
    unitIds.length
      ? (db
          .select(allocationSelect)
          .from(itemAllocation)
          .innerJoin(itemUnit, eq(itemUnit.id, itemAllocation.itemUnitId))
          .where(
            and(
              inArray(itemAllocation.itemUnitId, unitIds),
              isNull(itemAllocation.cancelledAt),
              sql`${itemAllocation.startsAt} < ${iso(range.to)} and ${itemAllocation.endsAt} > ${iso(range.from)}`,
            ),
          )
          .orderBy(asc(itemAllocation.startsAt)) as Promise<ItemAllocationRow[]>)
      : Promise.resolve([] as ItemAllocationRow[]),
    unitIds.length
      ? (db
          .select(allocationSelect)
          .from(itemAllocation)
          .innerJoin(itemUnit, eq(itemUnit.id, itemAllocation.itemUnitId))
          .where(
            and(
              inArray(itemAllocation.itemUnitId, unitIds),
              eq(itemAllocation.kind, "maintenance"),
            ),
          )
          .orderBy(desc(itemAllocation.startsAt)) as Promise<ItemAllocationRow[]>)
      : Promise.resolve([] as ItemAllocationRow[]),
    db.execute<{ outings: number; revenue: number }>(sql`
      select
        (select count(*) from item_allocation a join item_unit u on u.id = a.item_unit_id
          where u.item_id = ${itemId} and a.cancelled_at is null and a.kind in ('event', 'rental')
          and a.starts_at <= ${iso(range.now)})::int as outings,
        (select coalesce(sum(b.amount_cents), 0) from booking b
          where b.kind = 'rental' and b.status = 'confirmed' and exists (
            select 1 from item_allocation a join item_unit u on u.id = a.item_unit_id
            where a.booking_id = b.id and u.item_id = ${itemId}))::int as revenue`),
  ]);

  return {
    item: row,
    units,
    planning,
    maintenance,
    outings: totals?.outings ?? 0,
    rentalRevenueCents: totals?.revenue ?? 0,
  };
}

/** Matériel réservé pour un événement, regroupé par article. */
export async function listEventItems(db: Executor, organizationId: string, eventId: string) {
  return db
    .select({
      itemId: item.id,
      name: item.name,
      reference: item.reference,
      quantity: sql<number>`count(*)::int`,
      units: sql<string>`string_agg(${itemUnit.label}, ', ' order by ${itemUnit.label})`,
    })
    .from(itemAllocation)
    .innerJoin(itemUnit, eq(itemUnit.id, itemAllocation.itemUnitId))
    .innerJoin(item, eq(item.id, itemUnit.itemId))
    .where(
      and(
        eq(itemAllocation.organizationId, organizationId),
        eq(itemAllocation.eventId, eventId),
        isNull(itemAllocation.cancelledAt),
      ),
    )
    .groupBy(item.id, item.name, item.reference)
    .orderBy(asc(item.name));
}

/** Articles et exemplaires libres sur une période (choix du matériel d'un événement). */
export async function listItemsAvailableBetween(
  db: Executor,
  organizationId: string,
  period: { startsAt: Date; endsAt: Date },
  ignoreEventId?: string,
) {
  const ignore = ignoreEventId
    ? sql`and (a.event_id is null or a.event_id <> ${ignoreEventId})`
    : sql``;
  return db
    .select({
      id: item.id,
      name: item.name,
      reference: item.reference,
      units: sql<number>`(select count(*) from item_unit u where u.item_id = "item"."id" and u.status <> 'retired')::int`,
      free: sql<number>`(select count(*) from item_unit u where u.item_id = "item"."id" and u.status = 'available'
        and not exists (select 1 from item_allocation a where a.item_unit_id = u.id and a.cancelled_at is null
          and a.starts_at < ${iso(period.endsAt)} and a.ends_at > ${iso(period.startsAt)} ${ignore}))::int`,
    })
    .from(item)
    .where(and(eq(item.organizationId, organizationId), isNull(item.archivedAt)))
    .orderBy(asc(item.name));
}

/** Catégories de matériel déjà utilisées (suggestions du formulaire). */
export async function listItemTypeNames(db: Executor, organizationId: string): Promise<string[]> {
  const rows = await db
    .select({ name: itemType.name })
    .from(itemType)
    .where(and(eq(itemType.organizationId, organizationId), isNull(itemType.archivedAt)))
    .orderBy(asc(itemType.name));
  return rows.map((row) => row.name);
}
