import { and, eq, gt, isNull, lt, lte, sql } from "drizzle-orm";
import type { Executor } from "../client";
import { booking, event } from "../schema";

/*
 * Rappels de la veille, pour tous les espaces. Chaque envoi est « réservé » par une mise à jour
 * conditionnelle (reminder_sent_at encore vide) : deux passages simultanés n'envoient jamais
 * deux fois le même rappel.
 */

/** Événements publiés qui commencent dans (from, to], pas encore rappelés : marqués et renvoyés. */
export async function claimEventReminders(db: Executor, from: Date, to: Date) {
  return db
    .update(event)
    .set({ reminderSentAt: sql`now()` })
    .where(
      and(
        eq(event.status, "published"),
        gt(event.startsAt, from),
        lte(event.startsAt, to),
        isNull(event.reminderSentAt),
      ),
    )
    .returning({
      id: event.id,
      organizationId: event.organizationId,
      title: event.title,
      startsAt: event.startsAt,
      endsAt: event.endsAt,
      timezone: event.timezone,
      capacity: event.capacity,
    });
}

/** Réservations confirmées de l'événement, faites avant `bookedBefore`, pas encore rappelées. */
export async function claimBookingReminders(db: Executor, eventId: string, bookedBefore: Date) {
  return db
    .update(booking)
    .set({ reminderSentAt: sql`now()` })
    .where(
      and(
        eq(booking.eventId, eventId),
        eq(booking.status, "confirmed"),
        lt(booking.createdAt, bookedBefore),
        isNull(booking.reminderSentAt),
      ),
    )
    .returning({ id: booking.id, seats: booking.seats });
}

/** Places confirmées d'un événement (rappel à l'équipe). */
export async function countConfirmedSeats(db: Executor, eventId: string): Promise<number> {
  const [row] = await db
    .select({ value: sql<number>`coalesce(sum(${booking.seats}), 0)::int` })
    .from(booking)
    .where(and(eq(booking.eventId, eventId), eq(booking.status, "confirmed")));
  return row?.value ?? 0;
}
