import {
  type BookingNoun,
  type CalendarLink,
  calendarLinkAllows,
  type EventModules,
  type EventTypeField,
  type EventVisibility,
  type FieldValues,
  formRules,
  type PaymentMode,
  publicFieldsView,
  publicModules,
  type Rule,
  type SeriesKind,
} from "@horaya/core";
import { and, asc, eq, gte, inArray, isNull, type SQL, sql } from "drizzle-orm";
import type { Executor } from "../client";
import {
  booking,
  bookingParticipant,
  calendarLink,
  customer,
  event,
  eventSeries,
  eventType,
  member,
  organization,
  slotHold,
  tenantSettings,
  user,
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
  rules: event.rules,
  seatsHeld,
  /** Stage (lot 37) : la série, son genre, et le sujet de la séance. */
  seriesId: event.seriesId,
  seriesKind: sql<SeriesKind | null>`(select s.kind from event_series s where s.id = "event"."series_id")`,
  sessionTopic: event.sessionTopic,
  stagePriceCents: sql<
    number | null
  >`(select s.enrollment_price_cents from event_series s where s.id = "event"."series_id" and s.kind = 'stage')`,
};

/**
 * Les champs internes de « Ce que tu décris », les documents et messages ne quittent jamais le
 * serveur ; des règles, seules les questions à poser partent, déjà tranchées pour l'événement.
 */
function toPublic<
  R extends {
    fields: EventTypeField[];
    fieldValues: FieldValues;
    modules: EventModules;
    onlineUrl: string | null;
    staffName: string | null;
    rules: Rule[];
    capacity: number | null;
    seatsHeld: number;
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
    rules: formRules(row.rules, row.fields, {
      fieldValues: row.fieldValues,
      capacity: row.capacity,
      seatsHeld: row.seatsHeld,
    }),
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
  /** Règles réduites aux questions du formulaire (voir formRules). */
  rules: Rule[];
  seatsHeld: number;
  seriesId: string | null;
  seriesKind: SeriesKind | null;
  sessionTopic: string | null;
  /** Stage : le prix de tout le stage (tarif par défaut). */
  stagePriceCents: number | null;
}

const isPublic = (organizationId: string) =>
  and(
    eq(event.organizationId, organizationId),
    eq(event.status, "published"),
    eq(event.visibility, "public"),
    // Créneaux réservés : ils ne sont pas à l'agenda (le type a sa propre page).
    eq(event.fromSlot, false),
  );

/** Un stage n'apparaît qu'une fois à l'agenda : sa prochaine séance porte toute l'offre. */
function oneCardPerStage(rows: PublicEventRow[]): PublicEventRow[] {
  const seen = new Set<string>();
  return rows.filter((row) => {
    if (row.seriesKind !== "stage" || !row.seriesId) return true;
    if (seen.has(row.seriesId)) return false;
    seen.add(row.seriesId);
    return true;
  });
}

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
  return oneCardPerStage(rows.map(toPublic));
}

/** Types « sur rendez-vous » (module Créneaux) de l'espace, pour la page publique. */
export async function listPublicSlotTypes(db: Executor, organizationId: string) {
  const rows = await db
    .select({
      id: eventType.id,
      name: eventType.name,
      color: eventType.color,
      description: eventType.description,
      defaultPriceCents: eventType.defaultPriceCents,
      modules: eventType.modules,
    })
    .from(eventType)
    .where(
      and(
        eq(eventType.organizationId, organizationId),
        isNull(eventType.archivedAt),
        sql`${eventType.modules} ? 'slots'`,
      ),
    )
    .orderBy(asc(eventType.name));
  return rows
    .filter((row) => !row.modules.access?.inviteOnly)
    .map(({ modules, ...row }) => ({
      ...row,
      /** « À partir de » : la durée la moins chère, sinon le prix du type. */
      fromCents: modules.duration
        ? Math.min(...modules.duration.options.map((option) => option.priceCents))
        : (row.defaultPriceCents ?? 0),
      durations: modules.duration?.options.map((option) => option.label) ?? [],
    }));
}
export type PublicSlotType = Awaited<ReturnType<typeof listPublicSlotTypes>>[number];

/**
 * Un type « sur rendez-vous », vu par un visiteur : de quoi choisir (durées, intervenants) et
 * le formulaire (questions, règles), comme un événement public.
 */
export async function getPublicSlotType(db: Executor, organizationId: string, typeId: string) {
  const [row] = await db
    .select({
      id: eventType.id,
      name: eventType.name,
      color: eventType.color,
      description: eventType.description,
      defaultDurationMinutes: eventType.defaultDurationMinutes,
      defaultPriceCents: eventType.defaultPriceCents,
      bookingNoun: eventType.bookingNoun,
      modules: eventType.modules,
      fields: eventType.fields,
      rules: eventType.rules,
    })
    .from(eventType)
    .where(
      and(
        eq(eventType.organizationId, organizationId),
        eq(eventType.id, typeId),
        isNull(eventType.archivedAt),
      ),
    );
  if (!row?.modules.slots || row.modules.access?.inviteOnly) return null;
  const memberIds = row.modules.slots.memberIds ?? [];
  const staff = memberIds.length
    ? await db
        .select({ id: member.id, name: user.name })
        .from(member)
        .innerJoin(user, eq(user.id, member.userId))
        .where(and(eq(member.organizationId, organizationId), inArray(member.id, memberIds)))
    : [];
  return {
    ...row,
    ...publicFieldsView(row.fields, {}),
    rules: formRules(row.rules, row.fields, { fieldValues: {}, capacity: null, seatsHeld: 0 }),
    /** Le type complet reste au serveur (créneaux, matériel) ; le visiteur voit la version publique. */
    modules: publicModules(row.modules),
    slots: row.modules.slots,
    duration: row.modules.duration ?? null,
    // Prénoms seulement, dans l'ordre choisi par l'atelier.
    staff: memberIds.flatMap((id) => {
      const found = staff.find((entry) => entry.id === id);
      return found ? [{ id, firstName: found.name.split(" ")[0] ?? found.name }] : [];
    }),
  };
}
export type PublicSlotTypeDetail = NonNullable<Awaited<ReturnType<typeof getPublicSlotType>>>;

/** Créneau gardé (lot 37), avec le prénom de l'intervenant retenu. */
export async function getSlotHold(db: Executor, organizationId: string, holdId: string) {
  const [row] = await db
    .select({
      id: slotHold.id,
      eventTypeId: slotHold.eventTypeId,
      startsAt: slotHold.startsAt,
      endsAt: slotHold.endsAt,
      durationId: slotHold.durationId,
      staffMemberId: slotHold.staffMemberId,
      seats: slotHold.seats,
      expiresAt: slotHold.expiresAt,
      staffName: user.name,
    })
    .from(slotHold)
    .leftJoin(member, eq(member.id, slotHold.staffMemberId))
    .leftJoin(user, eq(user.id, member.userId))
    .where(and(eq(slotHold.organizationId, organizationId), eq(slotHold.id, holdId)));
  return row ?? null;
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
      priceLines: booking.priceLines,
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
        eq(event.fromSlot, false),
        gte(event.startsAt, now),
        calendarLinkCondition(link),
      ),
    )
    .orderBy(asc(event.startsAt));
  return oneCardPerStage(rows.map(toPublic));
}
