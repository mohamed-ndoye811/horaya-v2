import { and, asc, eq, gt, inArray, sql } from "drizzle-orm";
import type { Executor } from "../client";
import {
  booking,
  customer,
  customerAccount,
  event,
  eventType,
  organization,
  tenantSettings,
} from "../schema";

/**
 * Lectures de l'espace client (lot 29). Les réservations d'un compte sont celles dont la fiche
 * client porte son e-mail : dans un espace (`organizationId`), seulement celles de cet espace ;
 * sans espace (vue horaya.app, maquette 8.5), celles de tous les espaces.
 */
export async function listAccountBookings(
  db: Executor,
  email: string,
  organizationId: string | null,
) {
  const startsAt = sql<Date>`coalesce(${event.startsAt}, ${booking.rentalStartsAt})`;
  const rows = await db
    .select({
      id: booking.id,
      organizationId: booking.organizationId,
      reference: booking.reference,
      kind: booking.kind,
      status: booking.status,
      seats: booking.seats,
      amountCents: booking.amountCents,
      depositCents: booking.depositCents,
      paymentMode: booking.paymentMode,
      paymentStatus: booking.paymentStatus,
      createdAt: booking.createdAt,
      eventId: booking.eventId,
      eventTitle: event.title,
      eventTypeId: event.eventTypeId,
      eventPriceCents: event.priceCents,
      eventPaymentMode: event.paymentMode,
      startsAt: sql<Date>`${startsAt}`.mapWith(event.startsAt),
      endsAt: sql<Date>`coalesce(${event.endsAt}, ${booking.rentalEndsAt})`.mapWith(event.endsAt),
      locationName: event.locationName,
      eventPaymentLinkUrl: event.paymentLinkUrl,
      workspace: {
        name: organization.name,
        slug: organization.slug,
        brandColor: sql<string>`coalesce(${tenantSettings.brandColor}, '#264489')`,
        timezone: sql<string>`coalesce(${tenantSettings.timezone}, 'Europe/Paris')`,
        freeCancellationHours: sql<number>`coalesce(${tenantSettings.freeCancellationHours}, 72)`,
        onlinePayments: sql<boolean>`coalesce(${tenantSettings.stripeAccountStatus} = 'active', false)`,
        paymentLinkUrl: tenantSettings.paymentLinkUrl,
      },
    })
    .from(booking)
    .innerJoin(customer, eq(customer.id, booking.customerId))
    .innerJoin(organization, eq(organization.id, booking.organizationId))
    .leftJoin(tenantSettings, eq(tenantSettings.organizationId, booking.organizationId))
    .leftJoin(event, eq(event.id, booking.eventId))
    .where(
      and(
        sql`lower(${customer.email}) = ${email.toLowerCase()}`,
        organizationId ? eq(booking.organizationId, organizationId) : undefined,
      ),
    )
    .orderBy(asc(startsAt), asc(booking.createdAt))
    .limit(1000);
  return rows;
}
export type AccountBooking = Awaited<ReturnType<typeof listAccountBookings>>[number];

/**
 * Changer de date (maquette 8.3) : les autres dates à venir du même type, publiées et
 * publiques, avec leurs places prises. Les règles (tarif, places, délai) sont appliquées par le
 * core (`rescheduleTargetIssue`).
 */
export async function listRescheduleCandidates(
  db: Executor,
  organizationId: string,
  current: { eventId: string; eventTypeId: string },
  now: Date,
) {
  return (await listCandidatesForTypes(db, [current.eventTypeId], now, organizationId))
    .filter((row) => row.id !== current.eventId)
    .slice(0, 24);
}

/** Les dates à venir, publiques et publiées, de plusieurs types d'un coup (cartes de l'accueil). */
export async function listCandidatesForTypes(
  db: Executor,
  eventTypeIds: string[],
  now: Date,
  organizationId?: string,
) {
  if (eventTypeIds.length === 0) return [];
  return db
    .select({
      id: event.id,
      eventTypeId: event.eventTypeId,
      status: event.status,
      visibility: event.visibility,
      startsAt: event.startsAt,
      endsAt: event.endsAt,
      capacity: event.capacity,
      priceCents: event.priceCents,
      paymentMode: event.paymentMode,
      bookingRules: eventType.bookingRules,
      seatsHeld: sql<number>`coalesce((
        select sum(b.seats) from booking b
        where b.event_id = "event"."id" and b.status in ('pending', 'confirmed')
      ), 0)::int`,
    })
    .from(event)
    .innerJoin(eventType, eq(eventType.id, event.eventTypeId))
    .where(
      and(
        organizationId ? eq(event.organizationId, organizationId) : undefined,
        inArray(event.eventTypeId, eventTypeIds),
        eq(event.status, "published"),
        eq(event.visibility, "public"),
        gt(event.startsAt, now),
      ),
    )
    .orderBy(asc(event.startsAt))
    .limit(2000);
}

/** Agenda personnel d'un client : le compte de ce jeton, ou null. */
export async function findCustomerAccountByCalendarToken(db: Executor, token: string) {
  const [row] = await db
    .select({ id: customerAccount.id, email: customerAccount.email })
    .from(customerAccount)
    .where(eq(customerAccount.calendarToken, token));
  return row ?? null;
}
