import { and, desc, eq, sql } from "drizzle-orm";
import type { Executor } from "../client";
import { booking, customer, event, ruleRun } from "../schema";

/*
 * Règles « si… alors… » (lot 36) : ce que la tâche planifiée doit exécuter, et le journal des
 * règles qui ont agi sur un événement.
 */

const iso = (date: Date) => sql`${date.toISOString()}::timestamptz`;

/**
 * Règles planifiées à exécuter : événements publiés dont une règle « X avant la séance » ou
 * « après la séance » est dans sa fenêtre et n'a pas encore de trace. Le core revérifie tout
 * sous le verrou et prend la trace (deux passages simultanés n'exécutent qu'une fois).
 */
export async function listDueRules(db: Executor, now: Date) {
  const rows = await db.execute<{ organization_id: string; event_id: string; rule_id: string }>(sql`
    select e.organization_id, e.id as event_id, r.rule->>'id' as rule_id
    from ${event} e
    cross join lateral jsonb_array_elements(e.rules) as r(rule)
    where e.status = 'published'
      and jsonb_array_length(e.rules) > 0
      and (
        (r.rule->'trigger'->>'kind' = 'before_start'
          and ${iso(now)} >= e.starts_at - make_interval(hours => (r.rule->'trigger'->>'hours')::int)
          and ${iso(now)} < e.starts_at)
        or (r.rule->'trigger'->>'kind' = 'after_end'
          and ${iso(now)} >= e.ends_at
          and ${iso(now)} < e.ends_at + interval '2 days')
      )
      and not exists (
        select 1 from ${ruleRun} rr
        where rr.event_id = e.id and rr.rule_id = r.rule->>'id' and rr.booking_id is null
      )
    order by e.starts_at
  `);
  return rows.map((row) => ({
    organizationId: row.organization_id,
    eventId: row.event_id,
    ruleId: row.rule_id,
  }));
}

/** Règles qui ont agi sur un événement ou ses inscriptions, les plus récentes d'abord. */
export async function listEventRuleRuns(db: Executor, organizationId: string, eventId: string) {
  return db
    .select({
      id: ruleRun.id,
      ruleName: ruleRun.ruleName,
      actions: ruleRun.actions,
      createdAt: ruleRun.createdAt,
      bookingId: ruleRun.bookingId,
      bookingReference: booking.reference,
      customerName: sql<
        string | null
      >`nullif(trim(${customer.firstName} || ' ' || ${customer.lastName}), '')`,
    })
    .from(ruleRun)
    .leftJoin(booking, eq(booking.id, ruleRun.bookingId))
    .leftJoin(customer, eq(customer.id, booking.customerId))
    .where(
      and(
        eq(ruleRun.organizationId, organizationId),
        eq(ruleRun.eventId, eventId),
        eq(ruleRun.matched, true),
      ),
    )
    .orderBy(desc(ruleRun.createdAt))
    .limit(30);
}

/** « Tester sur une inscription » : les dernières inscriptions aux événements du type. */
export async function listRuleTestBookings(
  db: Executor,
  organizationId: string,
  eventTypeId: string,
) {
  return db
    .select({
      id: booking.id,
      reference: booking.reference,
      customerName: sql<string>`trim(${customer.firstName} || ' ' || ${customer.lastName})`,
      eventTitle: event.title,
      startsAt: event.startsAt,
    })
    .from(booking)
    .innerJoin(event, eq(event.id, booking.eventId))
    .innerJoin(customer, eq(customer.id, booking.customerId))
    .where(and(eq(booking.organizationId, organizationId), eq(event.eventTypeId, eventTypeId)))
    .orderBy(desc(booking.createdAt))
    .limit(20);
}
