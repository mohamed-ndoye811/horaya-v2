import type { RuleRepository } from "@horaya/core";
import { and, asc, eq, isNull, sql } from "drizzle-orm";
import type { Executor } from "../client";
import { booking, bookingParticipant, customer, itemAllocation, pass, ruleRun } from "../schema";

export function ruleRepository(db: Executor): RuleRepository {
  return {
    async claim(run) {
      const inserted = await db
        .insert(ruleRun)
        .values(run)
        .onConflictDoNothing({ target: [ruleRun.eventId, ruleRun.ruleId, ruleRun.bookingId] })
        .returning({ id: ruleRun.id });
      return inserted.length > 0;
    },

    async customerFacts(organizationId, customerId, { now, exceptBookingId, exceptEnrollmentId }) {
      const [row] = await db
        .select({
          tags: customer.tags,
          // Nouveau : aucune autre inscription en attente ou confirmée (passée comprise).
          isNew: sql<boolean>`not exists (
            select 1 from ${booking} b
            where b.customer_id = ${customer.id} and b.status in ('pending', 'confirmed')
              and b.id is distinct from ${exceptBookingId ?? null}::uuid
              and (${exceptEnrollmentId ?? null}::uuid is null
                or b.enrollment_id is distinct from ${exceptEnrollmentId ?? null}::uuid)
          )`,
          // Carte active : payée, encore valable, avec un solde.
          hasActivePass: sql<boolean>`exists (
            select 1 from ${pass} p
            where p.customer_id = ${customer.id} and p.status = 'active'
              and p.expires_at > ${now.toISOString()}::timestamptz
              and (select coalesce(sum(m.delta), 0) from pass_movement m where m.pass_id = p.id) > 0
          )`,
        })
        .from(customer)
        .where(and(eq(customer.organizationId, organizationId), eq(customer.id, customerId)));
      return row ?? { isNew: true, tags: [], hasActivePass: false };
    },

    async equipmentLeft(eventId) {
      const [row] = await db
        .select({ value: sql<number>`count(*)::int` })
        .from(itemAllocation)
        .where(
          and(
            eq(itemAllocation.eventId, eventId),
            eq(itemAllocation.kind, "event"),
            isNull(itemAllocation.bookingId),
            isNull(itemAllocation.cancelledAt),
          ),
        );
      return row?.value ?? 0;
    },

    async participantAnswers(bookingId) {
      const rows = await db
        .select({ answers: bookingParticipant.answers })
        .from(bookingParticipant)
        .where(eq(bookingParticipant.bookingId, bookingId))
        .orderBy(asc(bookingParticipant.createdAt), asc(bookingParticipant.id));
      return rows.map((row) => row.answers);
    },
  };
}
