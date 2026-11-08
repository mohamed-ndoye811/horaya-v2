import type { BookingStatus, EventStatus } from "@horaya/core";
import { and, asc, desc, eq, inArray, isNull, sql } from "drizzle-orm";
import type { Executor } from "../client";
import { booking, customer, event, eventSeries, eventType, seriesEnrollment } from "../schema";

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
  return rows.map((row) => ({
    ...row,
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
) {
  const [row] = await db
    .select({
      id: seriesEnrollment.id,
      seriesId: seriesEnrollment.seriesId,
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
  return { ...row, sessions };
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
