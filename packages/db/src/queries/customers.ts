import { and, asc, desc, eq, isNull, sql } from "drizzle-orm";
import type { Executor } from "../client";
import { customer, customerNote, member, user } from "../schema";

const iso = (date: Date) => sql`${date.toISOString()}::timestamptz`;
/** Les dates calculées en SQL brut arrivent en texte : on les convertit. */
const toDate = (value: unknown): Date | null =>
  value === null || value === undefined ? null : new Date(String(value));

export type CustomerSegment = "all" | "vip" | "company" | "inactive";

/** Seuil « VIP » : nombre de réservations actives ou étiquette posée par l'équipe. */
export const VIP_BOOKINGS = 5;
const INACTIVE_DAYS = 180;

export interface CustomerRow {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string | null;
  company: string | null;
  tags: string[];
  createdAt: Date;
  bookings: number;
  spentCents: number;
  lastVisit: Date | null;
  nextVisit: Date | null;
}

/**
 * Agrégats par client, en sous-requêtes corrélées (noms de tables explicites,
 * cf. packages/db/src/queries/events.ts).
 */
const aggregates = (now: Date) => ({
  bookings: sql<number>`(select count(*) from booking b where b.customer_id = "customer"."id" and b.status in ('pending', 'confirmed'))::int`,
  spentCents: sql<number>`(select coalesce(sum(b.amount_cents), 0) from booking b where b.customer_id = "customer"."id" and b.status = 'confirmed')::int`,
  lastVisit:
    sql<Date | null>`(select max(e.starts_at) from booking b join event e on e.id = b.event_id where b.customer_id = "customer"."id" and b.status = 'confirmed' and e.starts_at <= ${iso(now)})`.mapWith(
      toDate,
    ),
  nextVisit:
    sql<Date | null>`(select min(e.starts_at) from booking b join event e on e.id = b.event_id where b.customer_id = "customer"."id" and b.status in ('pending', 'confirmed') and e.starts_at > ${iso(now)})`.mapWith(
      toDate,
    ),
});

function segmentCondition(segment: CustomerSegment, now: Date) {
  const cutoff = new Date(now.getTime() - INACTIVE_DAYS * 86_400_000);
  switch (segment) {
    case "vip":
      return sql`('vip' = any(${customer.tags}) or (select count(*) from booking b where b.customer_id = "customer"."id" and b.status in ('pending', 'confirmed')) >= ${VIP_BOOKINGS})`;
    case "company":
      return sql`${customer.company} is not null`;
    case "inactive":
      return sql`not exists (select 1 from booking b where b.customer_id = "customer"."id" and b.created_at >= ${iso(cutoff)})
        and ${customer.createdAt} < ${iso(cutoff)}`;
    default:
      return undefined;
  }
}

/** Liste des clients (écran 22). */
export async function listCustomers(
  db: Executor,
  organizationId: string,
  options: { segment: CustomerSegment; now: Date; search?: string; limit?: number },
): Promise<CustomerRow[]> {
  const search = options.search?.trim();
  const rows = await db
    .select({
      id: customer.id,
      firstName: customer.firstName,
      lastName: customer.lastName,
      email: customer.email,
      phone: customer.phone,
      company: customer.company,
      tags: customer.tags,
      createdAt: customer.createdAt,
      ...aggregates(options.now),
    })
    .from(customer)
    .where(
      and(
        eq(customer.organizationId, organizationId),
        isNull(customer.anonymizedAt),
        segmentCondition(options.segment, options.now),
        search
          ? sql`(${customer.firstName} || ' ' || ${customer.lastName} ilike ${`%${search}%`} or ${customer.email} ilike ${`%${search}%`} or ${customer.company} ilike ${`%${search}%`})`
          : undefined,
      ),
    )
    .orderBy(asc(customer.lastName), asc(customer.firstName))
    .limit(options.limit ?? 500);
  return rows as CustomerRow[];
}

export async function countCustomersBySegment(db: Executor, organizationId: string, now: Date) {
  const counts = await Promise.all(
    (["all", "vip", "company", "inactive"] as const).map(async (segment) => {
      const [row] = await db
        .select({ value: sql<number>`count(*)::int` })
        .from(customer)
        .where(
          and(
            eq(customer.organizationId, organizationId),
            isNull(customer.anonymizedAt),
            segmentCondition(segment, now),
          ),
        );
      return [segment, row?.value ?? 0] as const;
    }),
  );
  return Object.fromEntries(counts) as Record<CustomerSegment, number>;
}

/** Bandeau de l'écran 22 : clients, nouveaux du mois, panier moyen, taux de retour. */
export async function getCustomerStats(db: Executor, organizationId: string, monthStart: Date) {
  const rows = await db.execute<{
    total: number;
    new_this_month: number;
    avg_basket: number | null;
    returning: number;
    with_booking: number;
  }>(sql`
    with per_customer as (
      select c.id, c.created_at,
        (select count(*) from booking b where b.customer_id = c.id and b.status in ('pending', 'confirmed')) as bookings
      from customer c
      where c.organization_id = ${organizationId} and c.anonymized_at is null
    )
    select
      count(*)::int as total,
      count(*) filter (where created_at >= ${iso(monthStart)})::int as new_this_month,
      (select avg(amount_cents) from booking where organization_id = ${organizationId} and status = 'confirmed' and amount_cents > 0)::int as avg_basket,
      count(*) filter (where bookings >= 2)::int as returning,
      count(*) filter (where bookings >= 1)::int as with_booking
    from per_customer`);
  const row = rows[0];
  return {
    total: row?.total ?? 0,
    newThisMonth: row?.new_this_month ?? 0,
    averageBasketCents: row?.avg_basket ?? null,
    returnRate:
      row && row.with_booking > 0 ? Math.round((row.returning / row.with_booking) * 100) : null,
  };
}

/** Fiche client (écran 23) : coordonnées, chiffres et notes internes. */
export async function getCustomerDetail(
  db: Executor,
  organizationId: string,
  customerId: string,
  now: Date,
) {
  const [row] = await db
    .select({
      id: customer.id,
      firstName: customer.firstName,
      lastName: customer.lastName,
      email: customer.email,
      phone: customer.phone,
      company: customer.company,
      tags: customer.tags,
      marketingConsent: customer.marketingConsent,
      createdAt: customer.createdAt,
      anonymizedAt: customer.anonymizedAt,
      ...aggregates(now),
      cancellations: sql<number>`(select count(*) from booking b where b.customer_id = "customer"."id" and b.status = 'cancelled')::int`,
    })
    .from(customer)
    .where(and(eq(customer.organizationId, organizationId), eq(customer.id, customerId)));
  if (!row) return null;

  const notes = await db
    .select({
      id: customerNote.id,
      body: customerNote.body,
      pinned: customerNote.pinned,
      createdAt: customerNote.createdAt,
      authorName: user.name,
    })
    .from(customerNote)
    .leftJoin(member, eq(member.id, customerNote.authorMemberId))
    .leftJoin(user, eq(user.id, member.userId))
    .where(
      and(eq(customerNote.organizationId, organizationId), eq(customerNote.customerId, customerId)),
    )
    .orderBy(desc(customerNote.pinned), desc(customerNote.createdAt));

  return {
    customer: row as typeof row & { lastVisit: Date | null; nextVisit: Date | null },
    notes,
  };
}
