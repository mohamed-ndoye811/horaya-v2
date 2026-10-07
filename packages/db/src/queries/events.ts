import type { BookingStatus, EventStatus, EventVisibility, PaymentMode } from "@horaya/core";
import { and, asc, desc, eq, gt, gte, ilike, isNull, lt, ne, or, type SQL, sql } from "drizzle-orm";
import type { Executor } from "../client";
import { booking, customer, event, eventType } from "../schema";

/**
 * Places occupées (en attente + confirmées), en sous-requête corrélée.
 * Noms de tables écrits en toutes lettres : Drizzle n'en préfixe pas les colonnes
 * quand la requête principale ne porte que sur une table, ce qui fausserait la corrélation.
 */
const seatsHeld = sql<number>`coalesce((
  select sum(b.seats) from booking b
  where b.event_id = "event"."id" and b.status in ('pending', 'confirmed')
), 0)::int`;

const iso = (date: Date) => sql`${date.toISOString()}::timestamptz`;

const eventColumns = {
  id: event.id,
  title: event.title,
  slug: event.slug,
  status: event.status,
  visibility: event.visibility,
  startsAt: event.startsAt,
  endsAt: event.endsAt,
  timezone: event.timezone,
  locationName: event.locationName,
  locationAddress: event.locationAddress,
  onlineUrl: event.onlineUrl,
  capacity: event.capacity,
  priceCents: event.priceCents,
  paymentMode: event.paymentMode,
  seriesId: event.seriesId,
  typeId: eventType.id,
  typeName: eventType.name,
  typeColor: eventType.color,
  seatsHeld,
};

export interface EventRow {
  id: string;
  title: string;
  slug: string;
  status: EventStatus;
  visibility: EventVisibility;
  startsAt: Date;
  endsAt: Date;
  timezone: string;
  locationName: string | null;
  locationAddress: string | null;
  onlineUrl: string | null;
  capacity: number | null;
  priceCents: number;
  paymentMode: PaymentMode;
  seriesId: string | null;
  typeId: string;
  typeName: string;
  typeColor: string;
  seatsHeld: number;
}

export type EventTab = "all" | "published" | "draft" | "past";

function tabCondition(tab: EventTab, now: Date): SQL | undefined {
  switch (tab) {
    case "published":
      return and(eq(event.status, "published"), gte(event.endsAt, now));
    case "draft":
      return eq(event.status, "draft");
    case "past":
      return and(lt(event.endsAt, now), ne(event.status, "draft"));
    default:
      return undefined;
  }
}

/** Liste des événements (écran 04) : onglet, recherche, type. */
export async function listEvents(
  db: Executor,
  organizationId: string,
  options: { tab: EventTab; now: Date; search?: string; typeId?: string; limit?: number },
): Promise<EventRow[]> {
  const search = options.search?.trim();
  const rows = await db
    .select(eventColumns)
    .from(event)
    .innerJoin(eventType, eq(eventType.id, event.eventTypeId))
    .where(
      and(
        eq(event.organizationId, organizationId),
        tabCondition(options.tab, options.now),
        options.typeId ? eq(event.eventTypeId, options.typeId) : undefined,
        search
          ? or(
              ilike(event.title, `%${search}%`),
              ilike(event.locationName, `%${search}%`),
              ilike(eventType.name, `%${search}%`),
            )
          : undefined,
      ),
    )
    .orderBy(options.tab === "past" ? desc(event.startsAt) : asc(event.startsAt))
    .limit(options.limit ?? 200);
  return rows as EventRow[];
}

/** Compteurs des onglets de la liste. */
export async function countEventsByTab(
  db: Executor,
  organizationId: string,
  now: Date,
): Promise<Record<EventTab, number>> {
  const [row] = await db
    .select({
      all: sql<number>`count(*)::int`,
      published: sql<number>`count(*) filter (where ${event.status} = 'published' and ${event.endsAt} >= ${iso(now)})::int`,
      draft: sql<number>`count(*) filter (where ${event.status} = 'draft')::int`,
      past: sql<number>`count(*) filter (where ${event.endsAt} < ${iso(now)} and ${event.status} <> 'draft')::int`,
    })
    .from(event)
    .where(eq(event.organizationId, organizationId));
  return row ?? { all: 0, published: 0, draft: 0, past: 0 };
}

/** Événements visibles sur une période (calendrier), annulés exclus. */
export async function listEventsInRange(
  db: Executor,
  organizationId: string,
  range: { from: Date; to: Date },
): Promise<EventRow[]> {
  const rows = await db
    .select(eventColumns)
    .from(event)
    .innerJoin(eventType, eq(eventType.id, event.eventTypeId))
    .where(
      and(
        eq(event.organizationId, organizationId),
        ne(event.status, "cancelled"),
        lt(event.startsAt, range.to),
        gt(event.endsAt, range.from),
      ),
    )
    .orderBy(asc(event.startsAt));
  return rows as EventRow[];
}

/** Prochains événements (tableau de bord), brouillons compris. */
export async function listUpcomingEvents(
  db: Executor,
  organizationId: string,
  now: Date,
  limit = 8,
): Promise<EventRow[]> {
  const rows = await db
    .select(eventColumns)
    .from(event)
    .innerJoin(eventType, eq(eventType.id, event.eventTypeId))
    .where(
      and(
        eq(event.organizationId, organizationId),
        ne(event.status, "cancelled"),
        gte(event.endsAt, now),
      ),
    )
    .orderBy(asc(event.startsAt))
    .limit(limit);
  return rows as EventRow[];
}

export interface EventTypeRow {
  id: string;
  name: string;
  color: string;
  description: string | null;
  defaultDurationMinutes: number | null;
  defaultPriceCents: number | null;
  defaultCapacity: number | null;
  requiresApproval: boolean;
  customFields: Array<{
    key: string;
    label: string;
    type: "text" | "select" | "checkbox";
    required: boolean;
    options?: string[];
  }>;
  bookingRules: {
    minAdvanceHours?: number;
    maxSeatsPerBooking?: number;
    waitlistEnabled?: boolean;
  };
  eventCount: number;
}

/** Types d'événements actifs (écran 16 et listes déroulantes). */
export async function listEventTypes(
  db: Executor,
  organizationId: string,
): Promise<EventTypeRow[]> {
  const rows = await db
    .select({
      id: eventType.id,
      name: eventType.name,
      color: eventType.color,
      description: eventType.description,
      defaultDurationMinutes: eventType.defaultDurationMinutes,
      defaultPriceCents: eventType.defaultPriceCents,
      defaultCapacity: eventType.defaultCapacity,
      requiresApproval: eventType.requiresApproval,
      customFields: eventType.customFields,
      bookingRules: eventType.bookingRules,
      eventCount: sql<number>`(select count(*) from event e where e.event_type_id = "event_type"."id")::int`,
    })
    .from(eventType)
    .where(and(eq(eventType.organizationId, organizationId), isNull(eventType.archivedAt)))
    .orderBy(asc(eventType.name));
  return rows as EventTypeRow[];
}

export interface EventBookingRow {
  id: string;
  reference: string;
  status: BookingStatus;
  seats: number;
  amountCents: number;
  paymentMode: PaymentMode;
  createdAt: Date;
  customerMessage: string | null;
  checkedInAt: Date | null;
  customerName: string;
  customerEmail: string;
}

/** Fiche d'un événement (écran 15) : événement, type, chiffres et réservations. */
export async function getEventDetail(db: Executor, organizationId: string, eventId: string) {
  const [row] = await db
    .select({
      ...eventColumns,
      description: event.description,
      highlights: event.highlights,
      paymentLinkUrl: event.paymentLinkUrl,
      requiresApproval: event.requiresApproval,
      depositPercent: event.depositPercent,
      publishedAt: event.publishedAt,
    })
    .from(event)
    .innerJoin(eventType, eq(eventType.id, event.eventTypeId))
    .where(and(eq(event.organizationId, organizationId), eq(event.id, eventId)));
  if (!row) return null;

  const bookings = (await db
    .select({
      id: booking.id,
      reference: booking.reference,
      status: booking.status,
      seats: booking.seats,
      amountCents: booking.amountCents,
      paymentMode: booking.paymentMode,
      createdAt: booking.createdAt,
      customerMessage: booking.customerMessage,
      checkedInAt: booking.checkedInAt,
      customerName: sql<string>`${customer.firstName} || ' ' || ${customer.lastName}`,
      customerEmail: customer.email,
    })
    .from(booking)
    .innerJoin(customer, eq(customer.id, booking.customerId))
    .where(eq(booking.eventId, eventId))
    .orderBy(asc(booking.createdAt))) as EventBookingRow[];

  const active = bookings.filter(
    (entry) => entry.status === "pending" || entry.status === "confirmed",
  );
  return {
    event: row as EventRow & {
      description: string;
      highlights: string[];
      paymentLinkUrl: string | null;
      requiresApproval: boolean;
      depositPercent: number | null;
      publishedAt: Date | null;
    },
    bookings,
    waitlisted: bookings
      .filter((entry) => entry.status === "waitlisted")
      .reduce((total, entry) => total + entry.seats, 0),
    bookedAmountCents: active.reduce((total, entry) => total + entry.amountCents, 0),
  };
}
