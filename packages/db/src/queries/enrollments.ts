import type { BookingStatus, EventStatus, EventTypeField, FieldValues } from "@horaya/core";
import { and, asc, desc, eq, inArray, isNull, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import type { Executor } from "../client";
import {
  booking,
  bookingParticipant,
  customer,
  event,
  eventSeries,
  eventType,
  seriesEnrollment,
} from "../schema";

/**
 * Lectures des inscriptions à une série (cours à l'année) : panneau de l'équipe, lien de
 * gestion du client, et bloc « Ton trimestre » de l'espace client (lot 29).
 */

const seatsHeld = sql<number>`coalesce((
  select sum(b.seats) from booking b
  where b.event_id = "event"."id" and b.status in ('pending', 'confirmed')
), 0)::int`;

/** Réglage d'une série, et ses séances encore ouvertes (publiées, pas commencées). */
export async function getSeriesOffer(
  db: Executor,
  organizationId: string,
  seriesId: string,
  now: Date,
) {
  const [series] = await db
    .select({
      id: eventSeries.id,
      enrollmentEnabled: eventSeries.enrollmentEnabled,
      enrollmentPriceCents: eventSeries.enrollmentPriceCents,
      dropInAllowed: eventSeries.dropInAllowed,
      enrollmentProrata: eventSeries.enrollmentProrata,
      makeupAllowed: eventSeries.makeupAllowed,
      timezone: eventSeries.timezone,
      /** Séances publiées de la série, passées comprises (base du prorata). */
      totalSessions: sql<number>`(select count(*)::int from event e where e.series_id = "event_series"."id" and e.status = 'published')`,
    })
    .from(eventSeries)
    .where(and(eq(eventSeries.organizationId, organizationId), eq(eventSeries.id, seriesId)));
  if (!series) return null;
  const sessions = await db
    .select({
      id: event.id,
      startsAt: event.startsAt,
      endsAt: event.endsAt,
      capacity: event.capacity,
      visibility: event.visibility,
      seatsHeld,
    })
    .from(event)
    .where(
      and(
        eq(event.organizationId, organizationId),
        eq(event.seriesId, seriesId),
        eq(event.status, "published"),
        sql`${event.startsAt} > ${now.toISOString()}::timestamptz`,
      ),
    )
    .orderBy(asc(event.startsAt));
  return {
    ...series,
    sessions,
    /** Séances complètes : l'inscription à toute la série est alors impossible. */
    fullSessions: sessions.filter(
      (session) => session.capacity !== null && session.seatsHeld >= session.capacity,
    ),
  };
}
export type SeriesOffer = NonNullable<Awaited<ReturnType<typeof getSeriesOffer>>>;

/** Séance à rattraper d'une inscription : disponible, utilisée sur une autre séance, ou échue. */
export interface EnrollmentMakeup {
  absentBookingId: string;
  absentEventId: string;
  absentTitle: string;
  absentStartsAt: Date;
  usedBookingId: string | null;
  state: "available" | "used" | "expired";
  usedEventId: string | null;
  usedTitle: string | null;
  usedStartsAt: Date | null;
}

/**
 * Séances à rattraper des inscriptions (absences signalées à temps). Disponible tant que la
 * série n'est pas finie ; la séance choisie pour la rattraper est celle d'une réservation
 * active qui la remplace (`makeup_for_booking_id`).
 */
async function loadMakeups(
  db: Executor,
  enrollmentIds: string[],
  seriesEndsAt: Map<string, Date>,
  seriesOf: Map<string, string>,
  now: Date,
) {
  const used = alias(booking, "makeup_booking");
  const usedEvent = alias(event, "makeup_event");
  const rows = await db
    .select({
      enrollmentId: booking.enrollmentId,
      absentBookingId: booking.id,
      absentEventId: event.id,
      absentTitle: event.title,
      absentStartsAt: event.startsAt,
      usedBookingId: used.id,
      usedEventId: usedEvent.id,
      usedTitle: usedEvent.title,
      usedStartsAt: usedEvent.startsAt,
    })
    .from(booking)
    .innerJoin(event, eq(event.id, booking.eventId))
    .leftJoin(
      used,
      and(eq(used.makeupForBookingId, booking.id), inArray(used.status, ["pending", "confirmed"])),
    )
    .leftJoin(usedEvent, eq(usedEvent.id, used.eventId))
    .where(
      and(
        inArray(booking.enrollmentId, enrollmentIds),
        sql`${booking.absentAt} is not null`,
        eq(booking.makeupEligible, true),
      ),
    )
    .orderBy(asc(event.startsAt));
  const byEnrollment = new Map<string, EnrollmentMakeup[]>();
  for (const row of rows) {
    const enrollmentId = row.enrollmentId ?? "";
    const end = seriesEndsAt.get(seriesOf.get(enrollmentId) ?? "");
    const state = row.usedEventId ? "used" : end && end > now ? "available" : "expired";
    byEnrollment.set(enrollmentId, [
      ...(byEnrollment.get(enrollmentId) ?? []),
      { ...row, state } as EnrollmentMakeup,
    ]);
  }
  return byEnrollment;
}

/** Fin de la dernière séance publiée de chaque série. */
async function loadSeriesEnds(db: Executor, seriesIds: string[]) {
  const rows = await db
    .select({ seriesId: event.seriesId, endsAt: sql<Date>`max(${event.endsAt})` })
    .from(event)
    .where(and(inArray(event.seriesId, seriesIds), eq(event.status, "published")))
    .groupBy(event.seriesId);
  return new Map(rows.map((row) => [row.seriesId ?? "", new Date(row.endsAt)]));
}

/** Réponses aux questions « Ce que tu demandes », posées à l'inscription (copiées sur chaque séance). */
export interface EnrollmentAnswers {
  fields: EventTypeField[];
  answers: FieldValues;
  participant: FieldValues;
}

async function loadAnswers(db: Executor, enrollmentIds: string[]) {
  const firsts = await db
    .selectDistinctOn([booking.enrollmentId], {
      enrollmentId: booking.enrollmentId,
      bookingId: booking.id,
      answers: booking.answers,
      fields: event.fields,
    })
    .from(booking)
    .innerJoin(event, eq(event.id, booking.eventId))
    .where(inArray(booking.enrollmentId, enrollmentIds))
    .orderBy(booking.enrollmentId, asc(event.startsAt));
  const participants = firsts.length
    ? await db
        .select({ bookingId: bookingParticipant.bookingId, answers: bookingParticipant.answers })
        .from(bookingParticipant)
        .where(
          inArray(
            bookingParticipant.bookingId,
            firsts.map((row) => row.bookingId),
          ),
        )
        .orderBy(asc(bookingParticipant.createdAt))
    : [];
  return new Map(
    firsts.map((row) => [
      row.enrollmentId ?? "",
      {
        fields: row.fields,
        answers: row.answers,
        participant: participants.find((entry) => entry.bookingId === row.bookingId)?.answers ?? {},
      } satisfies EnrollmentAnswers,
    ]),
  );
}

async function enrollmentExtras(
  db: Executor,
  rows: Array<{ id: string; seriesId: string }>,
  now: Date,
) {
  const ids = rows.map((row) => row.id);
  const ends = await loadSeriesEnds(db, [...new Set(rows.map((row) => row.seriesId))]);
  const [makeups, answers] = await Promise.all([
    loadMakeups(db, ids, ends, new Map(rows.map((row) => [row.id, row.seriesId])), now),
    loadAnswers(db, ids),
  ]);
  return { makeups, answers, ends };
}

/**
 * Séances de la série où l'on peut rattraper (même type d'événement, publiées, à venir, avant
 * la fin de la série) avec leurs places restantes ; hors celles où le client a déjà une place.
 */
export async function listMakeupTargets(
  db: Executor,
  organizationId: string,
  input: {
    /** La séance manquée : on cherche d'autres séances du même type, avant la fin de sa série. */
    absentEventId: string;
    seriesId: string;
    customerId: string;
    now: Date;
    publicOnly: boolean;
  },
) {
  const rows = await db
    .select({
      id: event.id,
      title: event.title,
      startsAt: event.startsAt,
      endsAt: event.endsAt,
      capacity: event.capacity,
      seatsHeld,
    })
    .from(event)
    .where(
      and(
        eq(event.organizationId, organizationId),
        sql`${event.eventTypeId} = (select e.event_type_id from event e where e.id = ${input.absentEventId})`,
        eq(event.status, "published"),
        sql`${event.id} <> ${input.absentEventId}`,
        sql`${event.startsAt} > ${input.now.toISOString()}::timestamptz`,
        sql`${event.startsAt} < (select max(e.ends_at) from event e where e.series_id = ${input.seriesId} and e.status = 'published')`,
        input.publicOnly ? eq(event.visibility, "public") : undefined,
        sql`not exists (select 1 from booking b where b.event_id = "event"."id" and b.customer_id = ${input.customerId} and b.status in ('pending', 'confirmed', 'waitlisted'))`,
      ),
    )
    .orderBy(asc(event.startsAt));
  return rows.filter((row) => row.capacity === null || row.seatsHeld < row.capacity);
}
export type MakeupTarget = Awaited<ReturnType<typeof listMakeupTargets>>[number];

/** Inscrits d'une série (fiche événement) : séances restantes, absences, paiement. */
export async function listSeriesEnrollments(
  db: Executor,
  organizationId: string,
  seriesId: string,
  now: Date,
) {
  const rows = await db
    .select({
      id: seriesEnrollment.id,
      customerId: customer.id,
      customerName: sql<string>`${customer.firstName} || ' ' || ${customer.lastName}`,
      customerEmail: customer.email,
      customerPhone: customer.phone,
      amountCents: seriesEnrollment.amountCents,
      paidAt: seriesEnrollment.paidAt,
      source: seriesEnrollment.source,
      cancelledAt: seriesEnrollment.cancelledAt,
      createdAt: seriesEnrollment.createdAt,
      seriesId: seriesEnrollment.seriesId,
    })
    .from(seriesEnrollment)
    .innerJoin(customer, eq(customer.id, seriesEnrollment.customerId))
    .where(
      and(
        eq(seriesEnrollment.organizationId, organizationId),
        eq(seriesEnrollment.seriesId, seriesId),
      ),
    )
    .orderBy(sql`${seriesEnrollment.cancelledAt} is not null`, desc(seriesEnrollment.createdAt));
  if (rows.length === 0) return [];

  const counts = await db
    .select({
      enrollmentId: booking.enrollmentId,
      sessions: sql<number>`count(*)::int`,
      remaining: sql<number>`count(*) filter (where ${booking.status} in ('pending', 'confirmed') and ${event.startsAt} > ${now.toISOString()}::timestamptz)::int`,
      absences: sql<number>`count(*) filter (where ${booking.absentAt} is not null)::int`,
    })
    .from(booking)
    .innerJoin(event, eq(event.id, booking.eventId))
    .where(
      inArray(
        booking.enrollmentId,
        rows.map((row) => row.id),
      ),
    )
    .groupBy(booking.enrollmentId);
  const byId = new Map(counts.map((count) => [count.enrollmentId, count]));
  const { makeups, answers } = await enrollmentExtras(db, rows, now);
  return rows.map((row) => ({
    ...row,
    makeups: makeups.get(row.id) ?? [],
    answers: answers.get(row.id) ?? null,
    sessions: byId.get(row.id)?.sessions ?? 0,
    remaining: byId.get(row.id)?.remaining ?? 0,
    absences: byId.get(row.id)?.absences ?? 0,
  }));
}
export type SeriesEnrollmentRow = Awaited<ReturnType<typeof listSeriesEnrollments>>[number];

export interface EnrollmentSession {
  bookingId: string;
  eventId: string;
  title: string;
  slug: string;
  startsAt: Date;
  endsAt: Date;
  locationName: string | null;
  eventStatus: EventStatus;
  status: BookingStatus;
  absent: boolean;
}

/**
 * Une inscription et ses séances (séances d'un événement annulé exclues). Sert au lien de
 * gestion du client et, avec `enrollmentProgress` du core, au bloc « Ton trimestre ».
 */
export async function getEnrollment(
  db: Executor,
  organizationId: string,
  where: { id: string } | { tokenHash: string },
  now: Date = new Date(),
) {
  const [row] = await db
    .select({
      id: seriesEnrollment.id,
      seriesId: seriesEnrollment.seriesId,
      makeupAllowed: sql<boolean>`(select s.makeup_allowed from event_series s where s.id = ${seriesEnrollment.seriesId})`,
      amountCents: seriesEnrollment.amountCents,
      currency: seriesEnrollment.currency,
      paidAt: seriesEnrollment.paidAt,
      cancelledAt: seriesEnrollment.cancelledAt,
      createdAt: seriesEnrollment.createdAt,
      customerId: customer.id,
      customerFirstName: customer.firstName,
      customerLastName: customer.lastName,
      customerEmail: customer.email,
    })
    .from(seriesEnrollment)
    .innerJoin(customer, eq(customer.id, seriesEnrollment.customerId))
    .where(
      and(
        eq(seriesEnrollment.organizationId, organizationId),
        "id" in where
          ? eq(seriesEnrollment.id, where.id)
          : eq(seriesEnrollment.manageTokenHash, where.tokenHash),
      ),
    );
  if (!row) return null;
  const sessions = (await db
    .select({
      bookingId: booking.id,
      eventId: event.id,
      title: event.title,
      slug: event.slug,
      startsAt: event.startsAt,
      endsAt: event.endsAt,
      locationName: event.locationName,
      eventStatus: event.status,
      status: booking.status,
      absent: sql<boolean>`${booking.absentAt} is not null`,
      // Pour le lien de paiement et la couleur du cours (première séance).
      paymentMode: event.paymentMode,
      paymentLinkUrl: event.paymentLinkUrl,
      typeColor: eventType.color,
    })
    .from(booking)
    .innerJoin(event, eq(event.id, booking.eventId))
    .innerJoin(eventType, eq(eventType.id, event.eventTypeId))
    .where(and(eq(booking.enrollmentId, row.id), sql`${event.status} <> 'cancelled'`))
    .orderBy(asc(event.startsAt))) as Array<
    EnrollmentSession & {
      paymentMode: string;
      paymentLinkUrl: string | null;
      typeColor: string;
    }
  >;
  const { makeups, answers, ends } = await enrollmentExtras(db, [row], now);
  return {
    ...row,
    sessions,
    seriesEndsAt: ends.get(row.seriesId) ?? null,
    makeups: makeups.get(row.id) ?? [],
    answers: answers.get(row.id) ?? null,
  };
}
export type EnrollmentDetail = NonNullable<Awaited<ReturnType<typeof getEnrollment>>>;

/** Inscriptions en cours d'un client (espace client, lot 29), la plus récente d'abord. */
export async function listCustomerEnrollmentIds(
  db: Executor,
  organizationId: string,
  customerId: string,
): Promise<string[]> {
  const rows = await db
    .select({ id: seriesEnrollment.id })
    .from(seriesEnrollment)
    .where(
      and(
        eq(seriesEnrollment.organizationId, organizationId),
        eq(seriesEnrollment.customerId, customerId),
        isNull(seriesEnrollment.cancelledAt),
      ),
    )
    .orderBy(desc(seriesEnrollment.createdAt));
  return rows.map((row) => row.id);
}
