import { and, asc, eq, gt, gte, isNotNull, isNull, lt, lte, or, sql } from "drizzle-orm";
import type { Executor } from "../client";
import { booking, event, payment, tenantSettings } from "../schema";

/*
 * Rappels de la veille, pour tous les espaces. Chaque envoi est « réservé » par une mise à jour
 * conditionnelle (reminder_sent_at encore vide) : deux passages simultanés n'envoient jamais
 * deux fois le même rappel.
 */

/** Événements publiés qui commencent dans (from, to], pas encore rappelés : marqués et renvoyés. */
export async function claimEventReminders(db: Executor, from: Date, to: Date) {
  return db
    .update(event)
    .set({ reminderSentAt: sql`now()` })
    .where(
      and(
        eq(event.status, "published"),
        gt(event.startsAt, from),
        lte(event.startsAt, to),
        isNull(event.reminderSentAt),
      ),
    )
    .returning({
      id: event.id,
      organizationId: event.organizationId,
      title: event.title,
      startsAt: event.startsAt,
      endsAt: event.endsAt,
      timezone: event.timezone,
      capacity: event.capacity,
      /** Rappel client à un autre moment (module Messages) : envoyé par claimDueCustomReminders. */
      customReminder: sql<boolean>`(${event.modules}->'messages'->'reminder') is not null`,
    });
}

/** Réservations confirmées de l'événement, faites avant `bookedBefore`, pas encore rappelées. */
export async function claimBookingReminders(db: Executor, eventId: string, bookedBefore: Date) {
  return db
    .update(booking)
    .set({ reminderSentAt: sql`now()` })
    .where(
      and(
        eq(booking.eventId, eventId),
        eq(booking.status, "confirmed"),
        lt(booking.createdAt, bookedBefore),
        isNull(booking.reminderSentAt),
      ),
    )
    .returning({ id: booking.id, seats: booking.seats });
}

/** Places confirmées d'un événement (rappel à l'équipe). */
export async function countConfirmedSeats(db: Executor, eventId: string): Promise<number> {
  const [row] = await db
    .select({ value: sql<number>`coalesce(sum(${booking.seats}), 0)::int` })
    .from(booking)
    .where(and(eq(booking.eventId, eventId), eq(booking.status, "confirmed")));
  return row?.value ?? 0;
}

const DAY = 86_400_000;
const iso = (date: Date) => sql`${date.toISOString()}::timestamptz`;

/** Places prises d'un événement (en attente de validation ou confirmées) : ce qui remplit la jauge. */
const heldSeats = sql<number>`(
  select coalesce(sum(b.seats), 0) from booking b
  where b.event_id = "event"."id" and b.status in ('pending', 'confirmed')
)::int`;

/**
 * « Événement presque complet » : 80 % de la jauge prise, pour un événement publié à venir.
 * Marqué une seule fois par événement (même si des places se libèrent ensuite).
 */
export async function claimAlmostFull(db: Executor, eventId: string) {
  const [row] = await db
    .update(event)
    .set({ almostFullNotifiedAt: sql`now()` })
    .where(
      and(
        eq(event.id, eventId),
        eq(event.status, "published"),
        isNull(event.almostFullNotifiedAt),
        isNotNull(event.capacity),
        gt(event.endsAt, sql`now()`),
        sql`${heldSeats} * 5 >= ${event.capacity} * 4`,
      ),
    )
    .returning({
      id: event.id,
      organizationId: event.organizationId,
      title: event.title,
      startsAt: event.startsAt,
      endsAt: event.endsAt,
      timezone: event.timezone,
      capacity: event.capacity,
      seats: heldSeats,
    });
  return row ?? null;
}

/**
 * Récap hebdomadaire : espaces dont c'est lundi, 8 h passées (dans leur fuseau), sans récap
 * depuis 6 jours. Marqués et renvoyés, tous espaces confondus.
 */
export async function claimWeeklyDigests(db: Executor, now: Date) {
  const local = sql`(${iso(now)} at time zone ${tenantSettings.timezone})`;
  return db
    .update(tenantSettings)
    .set({ weeklyDigestSentAt: now })
    .where(
      and(
        sql`extract(isodow from ${local}) = 1`,
        sql`extract(hour from ${local}) >= 8`,
        or(
          isNull(tenantSettings.weeklyDigestSentAt),
          lt(tenantSettings.weeklyDigestSentAt, new Date(now.getTime() - 6 * DAY)),
        ),
      ),
    )
    .returning({
      organizationId: tenantSettings.organizationId,
      timezone: tenantSettings.timezone,
    });
}

/** Chiffres du récap : les 7 jours écoulés et les événements publiés des 7 prochains jours. */
export async function getWeeklyDigest(db: Executor, organizationId: string, now: Date) {
  const weekAgo = iso(new Date(now.getTime() - 7 * DAY));
  const [bookings] = await db
    .select({
      created: sql<number>`count(*) filter (where ${booking.createdAt} >= ${weekAgo})::int`,
      seats: sql<number>`coalesce(sum(${booking.seats}) filter (where ${booking.createdAt} >= ${weekAgo} and ${booking.status} in ('pending', 'confirmed')), 0)::int`,
      cancelled: sql<number>`count(*) filter (where ${booking.cancelledAt} >= ${weekAgo})::int`,
      pending: sql<number>`count(*) filter (where ${booking.status} = 'pending')::int`,
    })
    .from(booking)
    .where(eq(booking.organizationId, organizationId));

  const [money] = await db
    .select({
      cents: sql<number>`coalesce(sum(case when ${payment.kind} = 'refund' then -${payment.amountCents} else ${payment.amountCents} end), 0)::int`,
    })
    .from(payment)
    .where(
      and(
        eq(payment.organizationId, organizationId),
        eq(payment.status, "succeeded"),
        gte(payment.createdAt, sql`${weekAgo}`),
      ),
    );

  const upcoming = await db
    .select({
      title: event.title,
      startsAt: event.startsAt,
      timezone: event.timezone,
      capacity: event.capacity,
      seats: heldSeats,
    })
    .from(event)
    .where(
      and(
        eq(event.organizationId, organizationId),
        eq(event.status, "published"),
        gte(event.startsAt, now),
        lt(event.startsAt, new Date(now.getTime() + 7 * DAY)),
      ),
    )
    .orderBy(asc(event.startsAt))
    .limit(10);

  return {
    bookings: bookings?.created ?? 0,
    seats: bookings?.seats ?? 0,
    cancelled: bookings?.cancelled ?? 0,
    pending: bookings?.pending ?? 0,
    revenueCents: money?.cents ?? 0,
    upcoming,
  };
}

/* ---------- Modules (lot 34) ---------- */

const minimum = sql`(${event.modules}->'places'->'minimum')`;
const minimumSeats = sql`(${minimum}->>'seats')::int`;
/** J-x : instant de la décision du seuil de maintien. */
const decisionAt = sql`(${event.startsAt} - make_interval(days => (${minimum}->>'daysBefore')::int))`;

const eventSummary = {
  id: event.id,
  organizationId: event.organizationId,
  title: event.title,
  startsAt: event.startsAt,
  endsAt: event.endsAt,
  timezone: event.timezone,
  capacity: event.capacity,
  seats: heldSeats,
  minimum: sql<number>`${minimumSeats}`,
};

/**
 * Seuil de maintien, la veille de J-x : événements publiés à qui il manque des inscrits, dont
 * l'équipe n'a pas encore été prévenue. Marqués et renvoyés.
 */
export async function claimMinimumWarnings(db: Executor, now: Date) {
  return db
    .update(event)
    .set({ minimumWarnedAt: now })
    .where(
      and(
        eq(event.status, "published"),
        isNull(event.minimumWarnedAt),
        isNull(event.minimumDecidedAt),
        sql`${minimum} is not null`,
        sql`${iso(now)} >= ${decisionAt} - interval '1 day'`,
        sql`${iso(now)} < ${decisionAt}`,
        sql`${heldSeats} < ${minimumSeats}`,
      ),
    )
    .returning(eventSummary);
}

/**
 * Seuil de maintien à J-x : événements publiés à venir dont la décision n'est pas prise. Marqués
 * (une seule décision) et renvoyés ; le core annule ceux qui restent sous le seuil.
 */
export async function claimMinimumDecisions(db: Executor, now: Date) {
  return db
    .update(event)
    .set({ minimumDecidedAt: now })
    .where(
      and(
        eq(event.status, "published"),
        isNull(event.minimumDecidedAt),
        sql`${minimum} is not null`,
        sql`${iso(now)} >= ${decisionAt}`,
        gt(event.startsAt, now),
      ),
    )
    .returning(eventSummary);
}

/** Moment du rappel choisi dans le module Messages : la veille à H heures (fuseau de l'événement) ou X heures avant. */
const reminderAt = sql`(case when ${event.modules}->'messages'->'reminder'->>'kind' = 'eve'
  then (date_trunc('day', ${event.startsAt} at time zone ${event.timezone}) - interval '1 day'
    + make_interval(hours => (${event.modules}->'messages'->'reminder'->>'hour')::int)) at time zone ${event.timezone}
  else ${event.startsAt} - make_interval(hours => (${event.modules}->'messages'->'reminder'->>'hours')::int)
end)`;

/**
 * Rappels au moment choisi (module Messages) : réservations confirmées, faites avant ce moment,
 * d'événements publiés qui n'ont pas commencé. Marquées et renvoyées.
 */
export async function claimDueCustomReminders(db: Executor, now: Date) {
  return db
    .update(booking)
    .set({ reminderSentAt: sql`now()` })
    .from(event)
    .where(
      and(
        eq(event.id, booking.eventId),
        eq(event.status, "published"),
        gt(event.startsAt, now),
        sql`(${event.modules}->'messages'->'reminder') is not null`,
        sql`${reminderAt} <= ${iso(now)}`,
        sql`${booking.createdAt} < ${reminderAt}`,
        eq(booking.status, "confirmed"),
        isNull(booking.reminderSentAt),
      ),
    )
    .returning({ id: booking.id, organizationId: booking.organizationId });
}

/**
 * Message après la séance (module Messages) : événements terminés depuis moins de deux jours,
 * pas encore traités. Marqués et renvoyés avec le texte.
 */
export async function claimFollowUps(db: Executor, now: Date) {
  return db
    .update(event)
    .set({ followUpSentAt: now })
    .where(
      and(
        eq(event.status, "published"),
        isNull(event.followUpSentAt),
        sql`coalesce(${event.modules}->'messages'->>'after', '') <> ''`,
        lte(event.endsAt, now),
        gt(event.endsAt, new Date(now.getTime() - 2 * DAY)),
      ),
    )
    .returning({ id: event.id, organizationId: event.organizationId });
}

/** Réservations confirmées d'un événement (message après la séance), sans les absences signalées. */
export async function listConfirmedBookingIds(db: Executor, eventId: string) {
  const rows = await db
    .select({ id: booking.id })
    .from(booking)
    .where(
      and(eq(booking.eventId, eventId), eq(booking.status, "confirmed"), isNull(booking.absentAt)),
    );
  return rows.map((row) => row.id);
}
