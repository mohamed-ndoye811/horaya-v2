import type { BookingStatus, PaymentMode } from "@horaya/core";
import { and, desc, eq, gte, inArray, lt, sql } from "drizzle-orm";
import type { Executor } from "../client";
import { booking, customer, event } from "../schema";
import { bookingTitle } from "./bookings";

const iso = (date: Date) => sql`${date.toISOString()}::timestamptz`;

/** Chiffres du bandeau du tableau de bord (écran 03). Les bornes sont calculées par l'appelant (fuseau de l'espace). */
export async function getDashboardStats(
  db: Executor,
  organizationId: string,
  bounds: { now: Date; weekStart: Date; weekEnd: Date; previousWeekStart: Date; monthStart: Date },
) {
  const [events] = await db
    .select({
      thisWeek: sql<number>`count(*) filter (where ${event.startsAt} >= ${iso(bounds.weekStart)} and ${event.startsAt} < ${iso(bounds.weekEnd)})::int`,
      lastWeek: sql<number>`count(*) filter (where ${event.startsAt} >= ${iso(bounds.previousWeekStart)} and ${event.startsAt} < ${iso(bounds.weekStart)})::int`,
    })
    .from(event)
    .where(and(eq(event.organizationId, organizationId), eq(event.status, "published")));

  const [bookings] = await db
    .select({
      active: sql<number>`count(*) filter (where ${booking.status} in ('pending', 'confirmed'))::int`,
      thisMonth: sql<number>`count(*) filter (where ${booking.createdAt} >= ${iso(bounds.monthStart)})::int`,
      pending: sql<number>`count(*) filter (where ${booking.status} = 'pending')::int`,
    })
    .from(booking)
    .where(eq(booking.organizationId, organizationId));

  // Remplissage des événements publiés à venir qui ont une jauge.
  const [fill] = await db
    .select({
      capacity: sql<number>`coalesce(sum(${event.capacity}), 0)::int`,
      held: sql<number>`coalesce(sum((
        select coalesce(sum(b.seats), 0) from booking b
        where b.event_id = "event"."id" and b.status in ('pending', 'confirmed')
      )), 0)::int`,
    })
    .from(event)
    .where(
      and(
        eq(event.organizationId, organizationId),
        eq(event.status, "published"),
        gte(event.endsAt, bounds.now),
        sql`${event.capacity} is not null`,
      ),
    );

  return {
    eventsThisWeek: events?.thisWeek ?? 0,
    eventsLastWeek: events?.lastWeek ?? 0,
    activeBookings: bookings?.active ?? 0,
    bookingsThisMonth: bookings?.thisMonth ?? 0,
    pendingBookings: bookings?.pending ?? 0,
    fillRate: fill && fill.capacity > 0 ? Math.round((fill.held / fill.capacity) * 100) : null,
  };
}

/** Événements qui commencent dans une période (sous-titre « 2 événements démarrent aujourd'hui »). */
export async function countEventsStartingBetween(
  db: Executor,
  organizationId: string,
  from: Date,
  to: Date,
) {
  const [row] = await db
    .select({ value: sql<number>`count(*)::int` })
    .from(event)
    .where(
      and(
        eq(event.organizationId, organizationId),
        eq(event.status, "published"),
        gte(event.startsAt, from),
        lt(event.startsAt, to),
      ),
    );
  return row?.value ?? 0;
}

export interface LatestBookingRow {
  id: string;
  status: BookingStatus;
  seats: number;
  amountCents: number;
  paymentMode: PaymentMode;
  createdAt: Date;
  customerName: string;
  eventId: string | null;
  eventTitle: string | null;
}

/** Dernières réservations reçues (tableau de bord). */
export async function listLatestBookings(
  db: Executor,
  organizationId: string,
  limit = 8,
): Promise<LatestBookingRow[]> {
  const rows = await db
    .select({
      id: booking.id,
      status: booking.status,
      seats: booking.seats,
      amountCents: booking.amountCents,
      paymentMode: booking.paymentMode,
      createdAt: booking.createdAt,
      customerName: sql<string>`${customer.firstName} || ' ' || ${customer.lastName}`,
      eventId: booking.eventId,
      eventTitle: bookingTitle,
    })
    .from(booking)
    .innerJoin(customer, eq(customer.id, booking.customerId))
    .leftJoin(event, eq(event.id, booking.eventId))
    .where(
      and(
        eq(booking.organizationId, organizationId),
        inArray(booking.status, ["pending", "confirmed", "waitlisted", "refused", "cancelled"]),
      ),
    )
    .orderBy(desc(booking.createdAt))
    .limit(limit);
  return rows as LatestBookingRow[];
}
