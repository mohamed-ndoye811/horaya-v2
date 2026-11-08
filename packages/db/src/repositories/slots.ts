import type { Period, SlotHold, SlotRepository, TakenSlot } from "@horaya/core";
import { type AnyColumn, and, eq, gt, inArray, isNull, lt, ne, sql } from "drizzle-orm";
import type { Executor } from "../client";
import { booking, event, slotHold } from "../schema";

const iso = (date: Date) => sql`${date.toISOString()}::timestamptz`;

/** Module Créneaux (lot 37) : verrou, occupation des créneaux, créneaux gardés. */
export function slotRepository(db: Executor): SlotRepository {
  const liveHold = (now: Date, exceptHoldId?: string) =>
    and(gt(slotHold.expiresAt, now), exceptHoldId ? ne(slotHold.id, exceptHoldId) : undefined);
  const overlapping = (table: { startsAt: AnyColumn; endsAt: AnyColumn }, period: Period) =>
    and(lt(table.startsAt, period.endsAt), gt(table.endsAt, period.startsAt));

  return {
    async lock(organizationId) {
      await db.execute(
        sql`select pg_advisory_xact_lock(hashtextextended(${`slots:${organizationId}`}, 0))`,
      );
    },

    async taken(organizationId, eventTypeId, period, now, exceptHoldId) {
      const held = sql<number>`(
        coalesce((select sum(b.seats) from ${booking} b
          where b.event_id = "event"."id" and b.status in ('pending', 'confirmed')), 0)
        + coalesce((select sum(h.seats) from ${slotHold} h
          where h.event_id = "event"."id" and h.expires_at > ${iso(now)}
          ${exceptHoldId ? sql`and h.id <> ${exceptHoldId}` : sql``}), 0)
      )::int`;
      const events = await db
        .select({
          startsAt: event.startsAt,
          endsAt: event.endsAt,
          staffMemberId: event.staffMemberId,
          eventId: event.id,
          seatsHeld: held,
          capacity: event.capacity,
        })
        .from(event)
        .where(
          and(
            eq(event.organizationId, organizationId),
            eq(event.eventTypeId, eventTypeId),
            eq(event.fromSlot, true),
            ne(event.status, "cancelled"),
            overlapping(event, period),
          ),
        );
      const holds = await db
        .select({
          startsAt: slotHold.startsAt,
          endsAt: slotHold.endsAt,
          staffMemberId: slotHold.staffMemberId,
          seatsHeld: slotHold.seats,
        })
        .from(slotHold)
        .where(
          and(
            eq(slotHold.organizationId, organizationId),
            eq(slotHold.eventTypeId, eventTypeId),
            isNull(slotHold.eventId),
            liveHold(now, exceptHoldId),
            overlapping(slotHold, period),
          ),
        );
      return [
        ...(events as TakenSlot[]),
        ...holds.map((hold) => ({ ...hold, eventId: null, capacity: null })),
      ];
    },

    async staffBusy(organizationId, memberIds, period, now, exceptHoldId) {
      const busy: Record<string, Period[]> = {};
      const add = (memberId: string | null, entry: Period) => {
        if (memberId) busy[memberId] = [...(busy[memberId] ?? []), entry];
      };
      if (memberIds.length === 0) return busy;
      const events = await db
        .select({
          memberId: event.staffMemberId,
          startsAt: event.startsAt,
          endsAt: event.endsAt,
        })
        .from(event)
        .where(
          and(
            eq(event.organizationId, organizationId),
            inArray(event.staffMemberId, [...memberIds]),
            ne(event.status, "cancelled"),
            overlapping(event, period),
          ),
        );
      const holds = await db
        .select({
          memberId: slotHold.staffMemberId,
          startsAt: slotHold.startsAt,
          endsAt: slotHold.endsAt,
        })
        .from(slotHold)
        .where(
          and(
            eq(slotHold.organizationId, organizationId),
            inArray(slotHold.staffMemberId, [...memberIds]),
            isNull(slotHold.eventId),
            liveHold(now, exceptHoldId),
            overlapping(slotHold, period),
          ),
        );
      for (const entry of [...events, ...holds]) add(entry.memberId, entry);
      return busy;
    },

    async insertHold(values) {
      const [created] = await db.insert(slotHold).values(values).returning();
      if (!created) throw new Error("Créneau non gardé");
      return created as SlotHold;
    },

    async findHold(organizationId, holdId) {
      const [found] = await db
        .select()
        .from(slotHold)
        .where(and(eq(slotHold.organizationId, organizationId), eq(slotHold.id, holdId)));
      return (found as SlotHold | undefined) ?? null;
    },

    async deleteHold(organizationId, holdId) {
      await db
        .delete(slotHold)
        .where(and(eq(slotHold.organizationId, organizationId), eq(slotHold.id, holdId)));
    },

    async deleteExpiredHolds(organizationId, now) {
      const deleted = await db
        .delete(slotHold)
        .where(and(eq(slotHold.organizationId, organizationId), lt(slotHold.expiresAt, now)))
        .returning({ id: slotHold.id });
      return deleted.length;
    },
  };
}
