import type { BookingStatus, PaymentMode } from "@horaya/core";
import { and, desc, eq, gt, gte, inArray, lt, sql } from "drizzle-orm";
import type { Executor } from "../client";
import { booking, customer, event, eventType, payment } from "../schema";
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

/** Bornes du tableau de bord v4, calculées par l'appelant dans le fuseau de l'espace. */
export interface OverviewBounds {
  now: Date;
  /** Aujourd'hui, de minuit à minuit. */
  dayStart: Date;
  dayEnd: Date;
  /** Mois en cours (du 1er à maintenant) et même période du mois précédent. */
  monthStart: Date;
  previousMonthStart: Date;
  previousMonthSameMoment: Date;
  timeZone: string;
}

export interface TodayEntry {
  kind: "event" | "rental";
  id: string;
  title: string;
  startsAt: Date;
  endsAt: Date;
  color: string | null;
  locationName: string | null;
  /** Événement : places réservées et places pointées. */
  seatsHeld: number;
  checkedIn: number;
  capacity: number | null;
  /** Location : client qui rend le matériel. */
  customerName: string | null;
}

const heldSeats = sql<number>`coalesce((
  select sum(b.seats) from booking b
  where b.event_id = "event"."id" and b.status in ('pending', 'confirmed')
), 0)::int`;

/**
 * Données du tableau de bord v4 (maquette Paper 1.1) : cartes « À faire », programme du jour
 * et bande « Ce mois-ci ».
 */
export async function getDashboardOverview(
  db: Executor,
  organizationId: string,
  bounds: OverviewBounds,
) {
  const inOrg = eq(booking.organizationId, organizationId);

  const pendingRows = await db
    .select({
      firstName: customer.firstName,
      lastName: customer.lastName,
      createdAt: booking.createdAt,
    })
    .from(booking)
    .innerJoin(customer, eq(customer.id, booking.customerId))
    .where(and(inOrg, eq(booking.status, "pending")))
    .orderBy(booking.createdAt);

  // Paiements à noter : réservations actives payantes dont rien n'a encore été encaissé.
  const [toCollect] = await db
    .select({
      count: sql<number>`count(*)::int`,
      amountCents: sql<number>`coalesce(sum(${booking.amountCents}), 0)::int`,
      link: sql<number>`count(*) filter (where ${booking.paymentMode} in ('online', 'deposit'))::int`,
      onSite: sql<number>`count(*) filter (where ${booking.paymentMode} = 'on_site')::int`,
    })
    .from(booking)
    .where(
      and(
        inOrg,
        inArray(booking.status, ["pending", "confirmed"]),
        inArray(booking.paymentStatus, ["none", "failed"]),
        sql`${booking.paymentMode} <> 'free'`,
        sql`${booking.amountCents} > 0`,
      ),
    );

  // Liste d'attente : le total, et l'événement qui en a le plus.
  const waitlist = await db
    .select({
      eventId: event.id,
      title: event.title,
      capacity: event.capacity,
      seatsHeld: heldSeats,
      waiting: sql<number>`count(*)::int`,
    })
    .from(booking)
    .innerJoin(event, eq(event.id, booking.eventId))
    .where(and(inOrg, eq(booking.status, "waitlisted")))
    .groupBy(event.id)
    .orderBy(desc(sql`count(*)`));

  const drafts = await db
    .select({ id: event.id, title: event.title, startsAt: event.startsAt })
    .from(event)
    .where(
      and(
        eq(event.organizationId, organizationId),
        eq(event.status, "draft"),
        gte(event.startsAt, bounds.now),
      ),
    )
    .orderBy(event.startsAt);

  // Programme du jour : événements publiés qui touchent la journée, et retours de matériel.
  const todayEvents = await db
    .select({
      id: event.id,
      title: event.title,
      startsAt: event.startsAt,
      endsAt: event.endsAt,
      color: eventType.color,
      locationName: event.locationName,
      capacity: event.capacity,
      seatsHeld: heldSeats,
      checkedIn: sql<number>`coalesce((
        select sum(b.seats) from booking b
        where b.event_id = "event"."id" and b.status = 'confirmed' and b.checked_in_at is not null
      ), 0)::int`,
    })
    .from(event)
    .innerJoin(eventType, eq(eventType.id, event.eventTypeId))
    .where(
      and(
        eq(event.organizationId, organizationId),
        eq(event.status, "published"),
        lt(event.startsAt, bounds.dayEnd),
        gt(event.endsAt, bounds.dayStart),
      ),
    )
    .orderBy(event.startsAt);

  const returns = await db
    .select({
      id: booking.id,
      title: bookingTitle,
      startsAt: booking.rentalStartsAt,
      endsAt: booking.rentalEndsAt,
      customerName: sql<string>`${customer.firstName} || ' ' || ${customer.lastName}`,
    })
    .from(booking)
    .innerJoin(customer, eq(customer.id, booking.customerId))
    .leftJoin(event, eq(event.id, booking.eventId))
    .where(
      and(
        inOrg,
        eq(booking.kind, "rental"),
        eq(booking.status, "confirmed"),
        gte(booking.rentalEndsAt, bounds.dayStart),
        lt(booking.rentalEndsAt, bounds.dayEnd),
      ),
    );

  const today: TodayEntry[] = [
    ...todayEvents.map((row) => ({ ...row, kind: "event" as const, customerName: null })),
    ...returns.map((row) => ({
      kind: "rental" as const,
      id: row.id,
      title: row.title ?? "Location",
      // Une location s'affiche à son heure de retour.
      startsAt: row.endsAt as Date,
      endsAt: row.endsAt as Date,
      color: null,
      locationName: null,
      seatsHeld: 0,
      checkedIn: 0,
      capacity: null,
      customerName: row.customerName,
    })),
  ].sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime());

  // Ce mois-ci, comparé à la même période du mois précédent, jour par jour.
  const day = sql`date_trunc('day', ${booking.createdAt} at time zone ${bounds.timeZone})`;
  const bookingsByDayRows = await db
    .select({ day: sql<string>`to_char(${day}, 'YYYY-MM-DD')`, count: sql<number>`count(*)::int` })
    .from(booking)
    .where(
      and(
        inOrg,
        gte(booking.createdAt, bounds.monthStart),
        lt(booking.createdAt, bounds.now),
        inArray(booking.status, ["pending", "confirmed", "waitlisted"]),
      ),
    )
    .groupBy(sql`1`);
  const [previousBookings] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(booking)
    .where(
      and(
        inOrg,
        gte(booking.createdAt, bounds.previousMonthStart),
        lt(booking.createdAt, bounds.previousMonthSameMoment),
        inArray(booking.status, ["pending", "confirmed", "waitlisted"]),
      ),
    );

  const paidDay = sql`date_trunc('day', ${payment.createdAt} at time zone ${bounds.timeZone})`;
  const signedAmount = sql`case when ${payment.kind} = 'refund' then -${payment.amountCents} else ${payment.amountCents} end`;
  const collectedByDayRows = await db
    .select({
      day: sql<string>`to_char(${paidDay}, 'YYYY-MM-DD')`,
      cents: sql<number>`coalesce(sum(${signedAmount}), 0)::int`,
    })
    .from(payment)
    .where(
      and(
        eq(payment.organizationId, organizationId),
        eq(payment.status, "succeeded"),
        gte(payment.createdAt, bounds.monthStart),
        lt(payment.createdAt, bounds.now),
      ),
    )
    .groupBy(sql`1`);
  const [previousCollected] = await db
    .select({ cents: sql<number>`coalesce(sum(${signedAmount}), 0)::int` })
    .from(payment)
    .where(
      and(
        eq(payment.organizationId, organizationId),
        eq(payment.status, "succeeded"),
        gte(payment.createdAt, bounds.previousMonthStart),
        lt(payment.createdAt, bounds.previousMonthSameMoment),
      ),
    );

  const topWaitlist = waitlist[0];
  return {
    pending: {
      count: pendingRows.length,
      oldestAt: pendingRows[0]?.createdAt ?? null,
      people: pendingRows
        .slice(0, 3)
        .map((row) => ({ firstName: row.firstName, fullName: `${row.firstName} ${row.lastName}` })),
    },
    toCollect: {
      count: toCollect?.count ?? 0,
      amountCents: toCollect?.amountCents ?? 0,
      link: toCollect?.link ?? 0,
      onSite: toCollect?.onSite ?? 0,
    },
    waitlist: {
      count: waitlist.reduce((sum, row) => sum + row.waiting, 0),
      event: topWaitlist
        ? {
            id: topWaitlist.eventId,
            title: topWaitlist.title,
            seatsHeld: topWaitlist.seatsHeld,
            capacity: topWaitlist.capacity,
          }
        : null,
    },
    drafts: { count: drafts.length, next: drafts[0] ?? null },
    today,
    month: {
      bookingsByDay: Object.fromEntries(bookingsByDayRows.map((row) => [row.day, row.count])),
      previousBookings: previousBookings?.count ?? 0,
      collectedByDay: Object.fromEntries(collectedByDayRows.map((row) => [row.day, row.cents])),
      previousCollectedCents: previousCollected?.cents ?? 0,
    },
  };
}

export type DashboardOverview = Awaited<ReturnType<typeof getDashboardOverview>>;
