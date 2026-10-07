import type { BookingPaymentStatus, BookingSource, BookingStatus, PaymentMode } from "@horaya/core";
import { and, asc, count, desc, eq, gte, ilike, inArray, or, type SQL, sql } from "drizzle-orm";
import type { Executor } from "../client";
import {
  activityLog,
  booking,
  bookingParticipant,
  customer,
  event,
  eventType,
  item,
  itemAllocation,
  itemUnit,
  user,
} from "../schema";

const toDate = (value: unknown): Date | null =>
  value === null || value === undefined ? null : new Date(String(value));

/** Articles loués par une réservation de location (« Vidéoprojecteur, Micro HF »). */
export const rentalItemNames = sql<string | null>`(select string_agg(distinct i.name, ', ')
  from item_allocation a join item_unit u on u.id = a.item_unit_id join item i on i.id = u.item_id
  where a.booking_id = ${booking.id})`;
/** Titre affiché d'une réservation : l'événement, ou « Location · articles ». */
export const bookingTitle = sql<
  string | null
>`coalesce(${event.title}, 'Location · ' || ${rentalItemNames})`;
/** Début affiché : celui de l'événement, ou de la location. */
export const bookingStartsAt =
  sql<Date | null>`coalesce(${event.startsAt}, ${booking.rentalStartsAt})`.mapWith(toDate);

/**
 * Lectures pour l'affichage (listes, compteurs) : pas de règle métier ici,
 * les écritures passent par les cas d'usage du core.
 */
export async function countPendingBookings(db: Executor, organizationId: string): Promise<number> {
  const [row] = await db
    .select({ value: count() })
    .from(booking)
    .where(and(eq(booking.organizationId, organizationId), eq(booking.status, "pending")));
  return row?.value ?? 0;
}

const iso = (date: Date) => sql`${date.toISOString()}::timestamptz`;
const customerName = sql<string>`${customer.firstName} || ' ' || ${customer.lastName}`;

export type BookingTab = "all" | "pending" | "confirmed" | "waitlisted" | "cancelled";

const TAB_STATUSES: Record<Exclude<BookingTab, "all">, BookingStatus[]> = {
  pending: ["pending"],
  confirmed: ["confirmed"],
  waitlisted: ["waitlisted"],
  cancelled: ["cancelled", "refused"],
};

export interface BookingRow {
  id: string;
  reference: string;
  status: BookingStatus;
  seats: number;
  amountCents: number;
  paymentMode: PaymentMode;
  paymentStatus: BookingPaymentStatus;
  createdAt: Date;
  customerId: string;
  customerName: string;
  customerEmail: string;
  eventId: string | null;
  eventTitle: string | null;
  eventStartsAt: Date | null;
  typeColor: string | null;
}

/** Liste des réservations (écran 05) : statut, recherche, événement. */
export async function listBookings(
  db: Executor,
  organizationId: string,
  options: { tab: BookingTab; search?: string; eventId?: string; limit?: number },
): Promise<BookingRow[]> {
  const search = options.search?.trim();
  const conditions: Array<SQL | undefined> = [
    eq(booking.organizationId, organizationId),
    options.tab === "all" ? undefined : inArray(booking.status, TAB_STATUSES[options.tab]),
    options.eventId ? eq(booking.eventId, options.eventId) : undefined,
    search
      ? or(
          ilike(customerName, `%${search}%`),
          ilike(customer.email, `%${search}%`),
          ilike(bookingTitle, `%${search}%`),
          ilike(booking.reference, `%${search}%`),
        )
      : undefined,
  ];
  const rows = await db
    .select({
      id: booking.id,
      reference: booking.reference,
      status: booking.status,
      seats: booking.seats,
      amountCents: booking.amountCents,
      paymentMode: booking.paymentMode,
      paymentStatus: booking.paymentStatus,
      createdAt: booking.createdAt,
      customerId: customer.id,
      customerName,
      customerEmail: customer.email,
      eventId: event.id,
      eventTitle: bookingTitle,
      eventStartsAt: bookingStartsAt,
      typeColor: eventType.color,
    })
    .from(booking)
    .innerJoin(customer, eq(customer.id, booking.customerId))
    .leftJoin(event, eq(event.id, booking.eventId))
    .leftJoin(eventType, eq(eventType.id, event.eventTypeId))
    .where(and(...conditions))
    // Les demandes en attente d'abord, puis les plus récentes.
    .orderBy(sql`(${booking.status} = 'pending') desc`, desc(booking.createdAt))
    .limit(options.limit ?? 300);
  return rows as BookingRow[];
}

export async function countBookingsByTab(
  db: Executor,
  organizationId: string,
): Promise<Record<BookingTab, number>> {
  const [row] = await db
    .select({
      all: sql<number>`count(*)::int`,
      pending: sql<number>`count(*) filter (where ${booking.status} = 'pending')::int`,
      confirmed: sql<number>`count(*) filter (where ${booking.status} = 'confirmed')::int`,
      waitlisted: sql<number>`count(*) filter (where ${booking.status} = 'waitlisted')::int`,
      cancelled: sql<number>`count(*) filter (where ${booking.status} in ('cancelled', 'refused'))::int`,
    })
    .from(booking)
    .where(eq(booking.organizationId, organizationId));
  return row ?? { all: 0, pending: 0, confirmed: 0, waitlisted: 0, cancelled: 0 };
}

/** Montant des réservations confirmées reçues depuis une date (« 8 340 € réservés en juin »). */
export async function sumConfirmedBookingsSince(
  db: Executor,
  organizationId: string,
  since: Date,
): Promise<number> {
  const [row] = await db
    .select({ value: sql<number>`coalesce(sum(${booking.amountCents}), 0)::int` })
    .from(booking)
    .where(
      and(
        eq(booking.organizationId, organizationId),
        eq(booking.status, "confirmed"),
        sql`${booking.createdAt} >= ${iso(since)}`,
      ),
    );
  return row?.value ?? 0;
}

/** Événements publiés à venir, pour inscrire quelqu'un depuis l'admin. */
export async function listBookableEvents(db: Executor, organizationId: string, now: Date) {
  return db
    .select({
      id: event.id,
      title: event.title,
      startsAt: event.startsAt,
      capacity: event.capacity,
      priceCents: event.priceCents,
      seatsHeld: sql<number>`coalesce((select sum(b.seats) from booking b where b.event_id = "event"."id" and b.status in ('pending', 'confirmed')), 0)::int`,
    })
    .from(event)
    .where(
      and(
        eq(event.organizationId, organizationId),
        eq(event.status, "published"),
        gte(event.endsAt, now),
      ),
    )
    .orderBy(asc(event.startsAt));
}

const ACTIVITY_SELECT = {
  id: activityLog.id,
  action: activityLog.action,
  actorType: activityLog.actorType,
  actorName: user.name,
  data: activityLog.data,
  createdAt: activityLog.createdAt,
};

/** Fiche d'une réservation (écran 17) : réservation, client, événement, participants, historique. */
export async function getBookingDetail(db: Executor, organizationId: string, bookingId: string) {
  const [row] = await db
    .select({
      id: booking.id,
      reference: booking.reference,
      kind: booking.kind,
      status: booking.status,
      seats: booking.seats,
      amountCents: booking.amountCents,
      depositCents: booking.depositCents,
      paymentMode: booking.paymentMode,
      paymentStatus: booking.paymentStatus,
      source: booking.source,
      customerMessage: booking.customerMessage,
      refusalReason: booking.refusalReason,
      createdAt: booking.createdAt,
      confirmedAt: booking.confirmedAt,
      cancelledAt: booking.cancelledAt,
      rentalStartsAt: booking.rentalStartsAt,
      rentalEndsAt: booking.rentalEndsAt,
      customer: {
        id: customer.id,
        firstName: customer.firstName,
        lastName: customer.lastName,
        email: customer.email,
        phone: customer.phone,
        company: customer.company,
      },
      event: {
        id: event.id,
        title: event.title,
        startsAt: event.startsAt,
        endsAt: event.endsAt,
        locationName: event.locationName,
        capacity: event.capacity,
        status: event.status,
      },
      typeColor: eventType.color,
    })
    .from(booking)
    .innerJoin(customer, eq(customer.id, booking.customerId))
    .leftJoin(event, eq(event.id, booking.eventId))
    .leftJoin(eventType, eq(eventType.id, event.eventTypeId))
    .where(and(eq(booking.organizationId, organizationId), eq(booking.id, bookingId)));
  if (!row) return null;

  const [participants, activity, [stats], [held], rentalItems] = await Promise.all([
    db
      .select()
      .from(bookingParticipant)
      .where(eq(bookingParticipant.bookingId, bookingId))
      .orderBy(asc(bookingParticipant.createdAt)),
    db
      .select(ACTIVITY_SELECT)
      .from(activityLog)
      .leftJoin(user, eq(user.id, activityLog.actorId))
      .where(
        and(
          eq(activityLog.organizationId, organizationId),
          eq(activityLog.entityType, "booking"),
          eq(activityLog.entityId, bookingId),
        ),
      )
      .orderBy(desc(activityLog.createdAt)),
    db
      .select({
        bookings: sql<number>`count(*) filter (where ${booking.status} in ('pending', 'confirmed'))::int`,
        spentCents: sql<number>`coalesce(sum(${booking.amountCents}) filter (where ${booking.status} = 'confirmed'), 0)::int`,
        cancellations: sql<number>`count(*) filter (where ${booking.status} = 'cancelled')::int`,
      })
      .from(booking)
      .where(
        and(eq(booking.organizationId, organizationId), eq(booking.customerId, row.customer.id)),
      ),
    row.event?.id
      ? db
          .select({ value: sql<number>`coalesce(sum(${booking.seats}), 0)::int` })
          .from(booking)
          .where(
            and(
              eq(booking.eventId, row.event.id),
              inArray(booking.status, ["pending", "confirmed"]),
            ),
          )
      : Promise.resolve([{ value: 0 }]),
    row.kind === "rental"
      ? db
          .select({
            itemId: item.id,
            name: item.name,
            reference: item.reference,
            dailyRateCents: item.dailyRateCents,
            depositCents: item.depositCents,
            quantity: sql<number>`count(*)::int`,
            units: sql<string>`string_agg(${itemUnit.label}, ', ' order by ${itemUnit.label})`,
          })
          .from(itemAllocation)
          .innerJoin(itemUnit, eq(itemUnit.id, itemAllocation.itemUnitId))
          .innerJoin(item, eq(item.id, itemUnit.itemId))
          .where(eq(itemAllocation.bookingId, bookingId))
          .groupBy(item.id)
          .orderBy(asc(item.name))
      : Promise.resolve([]),
  ]);

  return {
    booking: row,
    participants,
    activity: activity as Array<{
      id: string;
      action: string;
      actorType: "member" | "customer" | "system";
      actorName: string | null;
      data: Record<string, unknown> | null;
      createdAt: Date;
    }>,
    customerStats: stats ?? { bookings: 0, spentCents: 0, cancellations: 0 },
    eventSeatsHeld: held?.value ?? 0,
    rentalItems,
  };
}

export type BookingSourceLabel = Record<BookingSource, string>;

/** Réservations d'un client (fiche client, écran 23), les plus récentes d'abord. */
export async function listCustomerBookings(
  db: Executor,
  organizationId: string,
  customerId: string,
) {
  return db
    .select({
      id: booking.id,
      status: booking.status,
      seats: booking.seats,
      amountCents: booking.amountCents,
      paymentMode: booking.paymentMode,
      createdAt: booking.createdAt,
      eventId: event.id,
      eventTitle: bookingTitle,
      eventStartsAt: bookingStartsAt,
      typeColor: eventType.color,
    })
    .from(booking)
    .leftJoin(event, eq(event.id, booking.eventId))
    .leftJoin(eventType, eq(eventType.id, event.eventTypeId))
    .where(and(eq(booking.organizationId, organizationId), eq(booking.customerId, customerId)))
    .orderBy(
      desc(sql`coalesce(${event.startsAt}, ${booking.rentalStartsAt}, ${booking.createdAt})`),
    );
}
