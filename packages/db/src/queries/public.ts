import {
  type BookingRules,
  type CalendarLink,
  type CustomFieldDefinition,
  calendarLinkAllows,
  type EventVisibility,
  type PaymentMode,
} from "@horaya/core";
import { and, asc, eq, gte, sql } from "drizzle-orm";
import type { Executor } from "../client";
import {
  booking,
  bookingParticipant,
  calendarLink,
  customer,
  event,
  eventSeries,
  eventType,
  organization,
  tenantSettings,
} from "../schema";
import { calendarLinkCondition } from "./calendar-links";

/**
 * Lectures des pages publiques (horaya.app/<espace>) : seulement ce qu'un visiteur peut voir,
 * événements publiés et publics.
 */

const seatsHeld = sql<number>`coalesce((
  select sum(b.seats) from booking b
  where b.event_id = "event"."id" and b.status in ('pending', 'confirmed')
), 0)::int`;

export async function getPublicWorkspace(db: Executor, slug: string) {
  const [row] = await db
    .select({
      id: organization.id,
      name: organization.name,
      slug: organization.slug,
      brandColor: sql<string>`coalesce(${tenantSettings.brandColor}, '#264489')`,
      displayFont: sql<string>`coalesce(${tenantSettings.displayFont}, 'display')`,
      description: tenantSettings.description,
      timezone: sql<string>`coalesce(${tenantSettings.timezone}, 'Europe/Paris')`,
      freeCancellationHours: sql<number>`coalesce(${tenantSettings.freeCancellationHours}, 72)`,
      lateCancellationRefundPercent: sql<number>`coalesce(${tenantSettings.lateCancellationRefundPercent}, 50)`,
      /** Paiement en ligne possible : compte Stripe de l'organisateur actif. */
      onlinePayments: sql<boolean>`coalesce(${tenantSettings.stripeAccountStatus} = 'active', false)`,
      /** Lien de paiement externe par défaut de l'espace. */
      paymentLinkUrl: tenantSettings.paymentLinkUrl,
      contactEmail: tenantSettings.contactEmail,
      contactPhone: tenantSettings.contactPhone,
      address: tenantSettings.address,
      legalName: tenantSettings.legalName,
      siret: tenantSettings.siret,
    })
    .from(organization)
    .leftJoin(tenantSettings, eq(tenantSettings.organizationId, organization.id))
    .where(eq(organization.slug, slug));
  return row ?? null;
}
export type PublicWorkspace = NonNullable<Awaited<ReturnType<typeof getPublicWorkspace>>>;

const publicEventColumns = {
  id: event.id,
  slug: event.slug,
  title: event.title,
  description: event.description,
  startsAt: event.startsAt,
  endsAt: event.endsAt,
  locationName: event.locationName,
  locationAddress: event.locationAddress,
  onlineUrl: event.onlineUrl,
  capacity: event.capacity,
  priceCents: event.priceCents,
  paymentMode: event.paymentMode,
  depositPercent: event.depositPercent,
  requiresApproval: event.requiresApproval,
  highlights: event.highlights,
  paymentLinkUrl: event.paymentLinkUrl,
  typeId: eventType.id,
  typeName: eventType.name,
  typeColor: eventType.color,
  bookingRules: eventType.bookingRules,
  visibility: event.visibility,
  seatsHeld,
};

export interface PublicEventRow {
  id: string;
  slug: string;
  title: string;
  description: string;
  startsAt: Date;
  endsAt: Date;
  locationName: string | null;
  locationAddress: string | null;
  onlineUrl: string | null;
  capacity: number | null;
  priceCents: number;
  paymentMode: PaymentMode;
  depositPercent: number | null;
  requiresApproval: boolean;
  highlights: string[];
  paymentLinkUrl: string | null;
  typeId: string;
  typeName: string;
  typeColor: string;
  bookingRules: BookingRules;
  visibility: EventVisibility;
  seatsHeld: number;
}

const isPublic = (organizationId: string) =>
  and(
    eq(event.organizationId, organizationId),
    eq(event.status, "published"),
    eq(event.visibility, "public"),
  );

/** Écran 27 : événements à venir de l'espace. */
export async function listPublicEvents(
  db: Executor,
  organizationId: string,
  now: Date,
): Promise<PublicEventRow[]> {
  const rows = await db
    .select(publicEventColumns)
    .from(event)
    .innerJoin(eventType, eq(eventType.id, event.eventTypeId))
    .where(and(isPublic(organizationId), gte(event.startsAt, now)))
    .orderBy(asc(event.startsAt));
  return rows as PublicEventRow[];
}

/**
 * Écran 10 : un événement publié, par son adresse. Public, ou « sur invitation » quand
 * le visiteur arrive par un lien calendrier actif qui le contient.
 */
export async function getPublicEvent(
  db: Executor,
  organizationId: string,
  slug: string,
  link: CalendarLink | null = null,
) {
  const [row] = await db
    .select({
      ...publicEventColumns,
      customFields: eventType.customFields,
      seriesRule: eventSeries.rrule,
    })
    .from(event)
    .innerJoin(eventType, eq(eventType.id, event.eventTypeId))
    .leftJoin(eventSeries, eq(eventSeries.id, event.seriesId))
    .where(
      and(
        eq(event.organizationId, organizationId),
        eq(event.status, "published"),
        eq(event.slug, slug),
      ),
    );
  const visible =
    row &&
    (row.visibility === "public" ||
      (link !== null && calendarLinkAllows(link, { id: row.id, eventTypeId: row.typeId })));
  return (visible ? row : null) as
    | (PublicEventRow & { customFields: CustomFieldDefinition[]; seriesRule: string | null })
    | null;
}

/** Réservation retrouvée par le jeton de son lien « Gérer ma réservation » (déjà haché). */
export async function getManagedBooking(db: Executor, organizationId: string, tokenHash: string) {
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
      currency: booking.currency,
      refusalReason: booking.refusalReason,
      rentalStartsAt: booking.rentalStartsAt,
      rentalEndsAt: booking.rentalEndsAt,
      createdAt: booking.createdAt,
      customerFirstName: customer.firstName,
      customerLastName: customer.lastName,
      customerEmail: customer.email,
      eventSlug: event.slug,
      eventTitle: event.title,
      eventStartsAt: event.startsAt,
      eventEndsAt: event.endsAt,
      eventStatus: event.status,
      eventVisibility: event.visibility,
      locationName: event.locationName,
      locationAddress: event.locationAddress,
      onlineUrl: event.onlineUrl,
      eventPaymentLinkUrl: event.paymentLinkUrl,
      typeColor: eventType.color,
    })
    .from(booking)
    .innerJoin(customer, eq(customer.id, booking.customerId))
    .leftJoin(event, eq(event.id, booking.eventId))
    .leftJoin(eventType, eq(eventType.id, event.eventTypeId))
    .where(and(eq(booking.organizationId, organizationId), eq(booking.manageTokenHash, tokenHash)));
  if (!row) return null;
  const participants = await db
    .select({ firstName: bookingParticipant.firstName, lastName: bookingParticipant.lastName })
    .from(bookingParticipant)
    .where(eq(bookingParticipant.bookingId, row.id))
    .orderBy(asc(bookingParticipant.createdAt));
  return { ...row, participants };
}
export type ManagedBooking = NonNullable<Awaited<ReturnType<typeof getManagedBooking>>>;

/** Lien calendrier actif d'un espace, par son adresse (null s'il est désactivé ou inconnu). */
export async function getPublicCalendarLink(
  db: Executor,
  organizationId: string,
  slug: string,
): Promise<CalendarLink | null> {
  const [row] = await db
    .select()
    .from(calendarLink)
    .where(
      and(
        eq(calendarLink.organizationId, organizationId),
        eq(calendarLink.slug, slug),
        eq(calendarLink.isActive, true),
      ),
    );
  return (row as CalendarLink | undefined) ?? null;
}

/** Événements à venir d'un lien calendrier, « sur invitation » compris. */
export async function listCalendarLinkEvents(
  db: Executor,
  link: CalendarLink,
  now: Date,
): Promise<PublicEventRow[]> {
  if (!link.isActive) return [];
  const rows = await db
    .select(publicEventColumns)
    .from(event)
    .innerJoin(eventType, eq(eventType.id, event.eventTypeId))
    .where(
      and(
        eq(event.organizationId, link.organizationId),
        eq(event.status, "published"),
        gte(event.startsAt, now),
        calendarLinkCondition(link),
      ),
    )
    .orderBy(asc(event.startsAt));
  return rows as PublicEventRow[];
}
