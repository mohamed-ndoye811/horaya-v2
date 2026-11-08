import {
  type BookingNoun,
  type CalendarLink,
  calendarLinkAllows,
  type EventModules,
  type EventTypeField,
  type EventVisibility,
  type FieldValues,
  type PaymentMode,
  publicFieldsView,
  publicModules,
} from "@horaya/core";
import { and, asc, eq, gte, type SQL, sql } from "drizzle-orm";
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
import { listBookingEquipment } from "./inventory";

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
      logo: organization.logo,
      coverImageUrl: tenantSettings.coverImageUrl,
      brandColor: sql<string>`coalesce(${tenantSettings.brandColor}, '#264489')`,
      displayFont: sql<string>`coalesce(${tenantSettings.displayFont}, 'display')`,
      description: tenantSettings.description,
      sector: tenantSettings.sector,
      timezone: sql<string>`coalesce(${tenantSettings.timezone}, 'Europe/Paris')`,
      freeCancellationHours: sql<number>`coalesce(${tenantSettings.freeCancellationHours}, 72)`,
      lateCancellationRefundPercent: sql<number>`coalesce(${tenantSettings.lateCancellationRefundPercent}, 50)`,
      /** Paiement en ligne possible : compte Stripe de l'organisateur actif. */
      onlinePayments: sql<boolean>`coalesce(${tenantSettings.stripeAccountStatus} = 'active', false)`,
      /** Lien de paiement externe par défaut de l'espace. */
      paymentLinkUrl: tenantSettings.paymentLinkUrl,
      giftCardsEnabled: sql<boolean>`coalesce((${tenantSettings.giftCards}->>'enabled')::boolean, false)`,
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
  requiresApproval: event.requiresApproval,
  highlights: event.highlights,
  paymentLinkUrl: event.paymentLinkUrl,
  coverImageUrl: event.coverImageUrl,
  staffName: sql<
    string | null
  >`(select u.name from member m join "user" u on u.id = m.user_id where m.id = "event"."staff_member_id")`,
  typeId: eventType.id,
  typeName: eventType.name,
  typeColor: eventType.color,
  modules: event.modules,
  bookingNoun: eventType.bookingNoun,
  visibility: event.visibility,
  fields: event.fields,
  fieldValues: event.fieldValues,
  seatsHeld,
};

/** Les champs internes de « Ce que tu décris », les documents et messages ne quittent jamais le serveur. */
function toPublic<
  R extends {
    fields: EventTypeField[];
    fieldValues: FieldValues;
    modules: EventModules;
    onlineUrl: string | null;
    staffName: string | null;
  },
>(row: R): Omit<R, "onlineUrl" | "staffName"> & { online: boolean; staffFirstName: string | null } {
  const { onlineUrl, staffName, ...rest } = row;
  return {
    ...rest,
    ...publicFieldsView(row.fields, row.fieldValues),
    modules: publicModules(row.modules),
    // Le lien de visio ne quitte pas le serveur avant l'inscription : on ne dit que « en ligne ».
    online: onlineUrl !== null,
    staffFirstName: row.modules.staff?.showOnPublicPage ? (staffName?.split(" ")[0] ?? null) : null,
  };
}

export interface PublicEventRow {
  id: string;
  slug: string;
  title: string;
  description: string;
  startsAt: Date;
  endsAt: Date;
  locationName: string | null;
  locationAddress: string | null;
  /** Lien de visio : jamais envoyé au navigateur, seulement « en ligne ou non ». */
  online: boolean;
  capacity: number | null;
  priceCents: number;
  paymentMode: PaymentMode;
  requiresApproval: boolean;
  highlights: string[];
  paymentLinkUrl: string | null;
  coverImageUrl: string | null;
  /** Module Intervenant, si l'équipe veut afficher son prénom. */
  staffFirstName: string | null;
  typeId: string;
  typeName: string;
  typeColor: string;
  /** Modules de l'événement, vus par un visiteur (voir publicModules). */
  modules: EventModules;
  bookingNoun: BookingNoun;
  visibility: EventVisibility;
  /** Champs de l'événement (sans les champs internes) et valeurs visibles. */
  fields: EventTypeField[];
  fieldValues: FieldValues;
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
  return rows.map(toPublic);
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
      seriesRule: eventSeries.rrule,
      seriesId: event.seriesId,
      /** Cours à l'année : inscription à toute la série (voir getSeriesOffer). */
      enrollmentEnabled: sql<boolean>`coalesce(${eventSeries.enrollmentEnabled}, false)`,
      dropInAllowed: sql<boolean>`coalesce(${eventSeries.dropInAllowed}, true)`,
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
  return (visible ? toPublic(row) : null) as
    | (PublicEventRow & {
        seriesRule: string | null;
        seriesId: string | null;
        enrollmentEnabled: boolean;
        dropInAllowed: boolean;
      })
    | null;
}

/** Réservation retrouvée par le jeton de son lien « Gérer ma réservation » (déjà haché). */
export function getManagedBooking(db: Executor, organizationId: string, tokenHash: string) {
  return findManagedBooking(
    db,
    and(eq(booking.organizationId, organizationId), eq(booking.manageTokenHash, tokenHash)),
  );
}

/**
 * Espace client (maquette 8.3) : une réservation de cet espace, seulement si sa fiche client
 * porte l'e-mail du compte connecté.
 */
export function getAccountBooking(
  db: Executor,
  organizationId: string,
  bookingId: string,
  email: string,
) {
  return findManagedBooking(
    db,
    and(
      eq(booking.organizationId, organizationId),
      eq(booking.id, bookingId),
      sql`lower(${customer.email}) = ${email.toLowerCase()}`,
    ),
  );
}

async function findManagedBooking(db: Executor, where: SQL | undefined) {
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
      enrollmentId: booking.enrollmentId,
      absentAt: booking.absentAt,
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
      /** Modules de l'événement (annulation, messages, documents) : c'est la réservation du client. */
      eventModules: event.modules,
      typeColor: eventType.color,
      eventId: event.id,
      eventTypeId: event.eventTypeId,
      eventDescription: event.description,
      eventCoverImageUrl: event.coverImageUrl,
      priceCents: event.priceCents,
      eventPaymentMode: event.paymentMode,
      answers: booking.answers,
      eventFields: event.fields,
    })
    .from(booking)
    .innerJoin(customer, eq(customer.id, booking.customerId))
    .leftJoin(event, eq(event.id, booking.eventId))
    .leftJoin(eventType, eq(eventType.id, event.eventTypeId))
    .where(where);
  if (!row) return null;
  const participants = await db
    .select({
      firstName: bookingParticipant.firstName,
      lastName: bookingParticipant.lastName,
      answers: bookingParticipant.answers,
    })
    .from(bookingParticipant)
    .where(eq(bookingParticipant.bookingId, row.id))
    .orderBy(asc(bookingParticipant.createdAt), asc(bookingParticipant.id));
  // Les champs internes de « Ce que tu décris » restent dans l'équipe.
  const { fields: eventFields } = publicFieldsView(row.eventFields ?? [], {});
  // Matériel réservé avec la place (module Matériel avancé).
  const equipment = await listBookingEquipment(db, row.id);
  return { ...row, eventFields, participants, equipment };
}
export type ManagedBooking = NonNullable<Awaited<ReturnType<typeof findManagedBooking>>>;

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
  return rows.map(toPublic);
}
