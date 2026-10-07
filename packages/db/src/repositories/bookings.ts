import type { Booking, BookingRepository } from "@horaya/core";
import { SEAT_HOLDING_STATUSES } from "@horaya/core";
import { and, asc, eq, getTableColumns, inArray, sql } from "drizzle-orm";
import type { Executor } from "../client";
import { booking, bookingParticipant } from "../schema";

const ACTIVE_STATUSES = ["pending", "confirmed", "waitlisted"] as const;

/** Colonnes exposées au core (le hash du jeton reste en base). */
const { manageTokenHash: _hidden, ...columns } = getTableColumns(booking);

export function bookingRepository(db: Executor): BookingRepository {
  const select = () => db.select(columns).from(booking);

  return {
    async seatsHeld(eventId) {
      const [row] = await db
        .select({ seats: sql<number>`coalesce(sum(${booking.seats}), 0)::int` })
        .from(booking)
        .where(
          and(eq(booking.eventId, eventId), inArray(booking.status, [...SEAT_HOLDING_STATUSES])),
        );
      return row?.seats ?? 0;
    },

    async insert(values, participants) {
      const [created] = await db.insert(booking).values(values).returning(columns);
      if (!created) throw new Error("Réservation non créée");
      if (participants.length > 0) {
        await db
          .insert(bookingParticipant)
          .values(participants.map((participant) => ({ ...participant, bookingId: created.id })));
      }
      return created as Booking;
    },

    async find(organizationId, bookingId) {
      const [found] = await select().where(
        and(eq(booking.organizationId, organizationId), eq(booking.id, bookingId)),
      );
      return (found as Booking | undefined) ?? null;
    },

    async findByManageTokenHash(organizationId, tokenHash) {
      const [found] = await select().where(
        and(eq(booking.organizationId, organizationId), eq(booking.manageTokenHash, tokenHash)),
      );
      return (found as Booking | undefined) ?? null;
    },

    async updateStatus(organizationId, bookingId, change) {
      const [updated] = await db
        .update(booking)
        .set(change)
        .where(and(eq(booking.organizationId, organizationId), eq(booking.id, bookingId)))
        .returning(columns);
      if (!updated) throw new Error(`Réservation introuvable : ${bookingId}`);
      return updated as Booking;
    },

    async listWaitlisted(eventId) {
      const rows = await select()
        .where(and(eq(booking.eventId, eventId), eq(booking.status, "waitlisted")))
        .orderBy(asc(booking.createdAt), asc(booking.id));
      return rows as Booking[];
    },

    async listActive(eventId) {
      const rows = await select()
        .where(and(eq(booking.eventId, eventId), inArray(booking.status, [...ACTIVE_STATUSES])))
        .orderBy(asc(booking.createdAt));
      return rows as Booking[];
    },
  };
}
