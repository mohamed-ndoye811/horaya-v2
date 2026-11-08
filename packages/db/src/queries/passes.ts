import { and, asc, desc, eq, isNull, sql } from "drizzle-orm";
import type { Executor } from "../client";
import { booking, customer, event, pass, passMovement, passPlan, tenantSettings } from "../schema";

const iso = (date: Date) => sql`${date.toISOString()}::timestamptz`;

/** Solde d'une carte : somme de son journal. */
const balance = sql<number>`(select coalesce(sum(m.delta), 0) from pass_movement m where m.pass_id = "pass"."id")::int`;

/** Formules de l'organisateur (archivées comprises), avec le nombre de cartes vendues. */
export async function listPassPlans(db: Executor, organizationId: string) {
  return db
    .select({
      id: passPlan.id,
      name: passPlan.name,
      sessions: passPlan.sessions,
      priceCents: passPlan.priceCents,
      validityDays: passPlan.validityDays,
      eventTypeIds: passPlan.eventTypeIds,
      archivedAt: passPlan.archivedAt,
      sold: sql<number>`(select count(*) from pass p where p.plan_id = "pass_plan"."id" and p.status = 'active')::int`,
    })
    .from(passPlan)
    .where(eq(passPlan.organizationId, organizationId))
    .orderBy(asc(passPlan.archivedAt), asc(passPlan.sessions), asc(passPlan.name));
}

/** Formules proposées sur la page publique de l'espace. */
export async function listPublicPassPlans(db: Executor, organizationId: string) {
  return db
    .select({
      id: passPlan.id,
      name: passPlan.name,
      sessions: passPlan.sessions,
      priceCents: passPlan.priceCents,
      validityDays: passPlan.validityDays,
    })
    .from(passPlan)
    .where(and(eq(passPlan.organizationId, organizationId), isNull(passPlan.archivedAt)))
    .orderBy(asc(passPlan.sessions));
}

/** Cartes vendues mais pas encore payées (à marquer payées par l'organisateur). */
export async function listPendingPasses(db: Executor, organizationId: string) {
  return db
    .select({
      id: pass.id,
      name: pass.name,
      priceCents: pass.priceCents,
      sessionsTotal: pass.sessionsTotal,
      createdAt: pass.createdAt,
      customerId: customer.id,
      customerName: sql<string>`${customer.firstName} || ' ' || ${customer.lastName}`,
    })
    .from(pass)
    .innerJoin(customer, eq(customer.id, pass.customerId))
    .where(and(eq(pass.organizationId, organizationId), eq(pass.status, "pending")))
    .orderBy(desc(pass.createdAt));
}

/** Cartes d'un client avec solde et journal (fiche client côté organisateur). */
export async function listCustomerPasses(db: Executor, organizationId: string, customerId: string) {
  const passes = await db
    .select({
      id: pass.id,
      name: pass.name,
      status: pass.status,
      sessionsTotal: pass.sessionsTotal,
      priceCents: pass.priceCents,
      eventTypeIds: pass.eventTypeIds,
      activatedAt: pass.activatedAt,
      expiresAt: pass.expiresAt,
      createdAt: pass.createdAt,
      balance,
    })
    .from(pass)
    .where(and(eq(pass.organizationId, organizationId), eq(pass.customerId, customerId)))
    .orderBy(desc(pass.createdAt));
  if (passes.length === 0) return [];

  const movements = await db
    .select({
      id: passMovement.id,
      passId: passMovement.passId,
      kind: passMovement.kind,
      delta: passMovement.delta,
      reason: passMovement.reason,
      actorType: passMovement.actorType,
      createdAt: passMovement.createdAt,
      bookingId: passMovement.bookingId,
      bookingReference: booking.reference,
      eventTitle: event.title,
    })
    .from(passMovement)
    .innerJoin(pass, eq(pass.id, passMovement.passId))
    .leftJoin(booking, eq(booking.id, passMovement.bookingId))
    .leftJoin(event, eq(event.id, booking.eventId))
    .where(and(eq(pass.organizationId, organizationId), eq(pass.customerId, customerId)))
    .orderBy(desc(passMovement.createdAt), desc(passMovement.id));
  return passes.map((entry) => ({
    ...entry,
    movements: movements.filter((movement) => movement.passId === entry.id),
  }));
}

/** Cartes utilisables par un client pour un type d'événement (comptoir, espace client). */
export async function listUsablePasses(
  db: Executor,
  organizationId: string,
  customerId: string,
  eventTypeId: string | null,
  now: Date,
  /** Début de la séance à régler : la carte doit être valable à cette date (sinon, à `now`). */
  sessionStartsAt?: Date,
) {
  const rows = await db
    .select({
      id: pass.id,
      name: pass.name,
      sessionsTotal: pass.sessionsTotal,
      expiresAt: pass.expiresAt,
      balance,
    })
    .from(pass)
    .where(
      and(
        eq(pass.organizationId, organizationId),
        eq(pass.customerId, customerId),
        eq(pass.status, "active"),
        sql`${pass.expiresAt} > ${iso(now)}`,
        sessionStartsAt ? sql`${pass.expiresAt} > ${iso(sessionStartsAt)}` : undefined,
        eventTypeId
          ? sql`(cardinality(${pass.eventTypeIds}) = 0 or ${eventTypeId}::uuid = any(${pass.eventTypeIds}))`
          : undefined,
        sql`(select coalesce(sum(m.delta), 0) from pass_movement m where m.pass_id = "pass"."id") > 0`,
      ),
    )
    // La carte qui expire en premier est proposée en premier.
    .orderBy(asc(pass.expiresAt));
  return rows as Array<(typeof rows)[number] & { expiresAt: Date }>;
}

/**
 * Bloc « Ma carte de séances » de l'espace client (lot 29) : cartes utilisables du client,
 * avec séances restantes, total et date de fin.
 */
export async function getCustomerPassSummary(
  db: Executor,
  organizationId: string,
  customerId: string,
  now: Date,
) {
  const rows = await listUsablePasses(db, organizationId, customerId, null, now);
  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    remaining: row.balance,
    total: row.sessionsTotal,
    expiresAt: row.expiresAt,
  }));
}

/** Ce qu'il faut pour l'e-mail « Ta carte est active » (carte, client, solde). */
export async function getPassForEmail(db: Executor, organizationId: string, passId: string) {
  const [row] = await db
    .select({
      name: pass.name,
      expiresAt: pass.expiresAt,
      customerEmail: customer.email,
      customerFirstName: customer.firstName,
      balance,
    })
    .from(pass)
    .innerJoin(customer, eq(customer.id, pass.customerId))
    .where(and(eq(pass.organizationId, organizationId), eq(pass.id, passId)));
  return row ?? null;
}

/** Une formule proposée au public, si elle l'est encore (page de remerciement). */
export async function getPublicPassPlan(db: Executor, organizationId: string, planId: string) {
  const [row] = await db
    .select({ id: passPlan.id, name: passPlan.name, sessions: passPlan.sessions })
    .from(passPlan)
    .where(and(eq(passPlan.organizationId, organizationId), eq(passPlan.id, planId)));
  return row ?? null;
}

/** Type et début d'un événement (pour filtrer les cartes acceptées) ; null si l'événement n'existe pas. */
export async function getEventTypeById(db: Executor, organizationId: string, eventId: string) {
  const [row] = await db
    .select({ eventTypeId: event.eventTypeId, startsAt: event.startsAt })
    .from(event)
    .where(and(eq(event.organizationId, organizationId), eq(event.id, eventId)));
  return row ?? null;
}

/**
 * Annulation d'une réservation par l'équipe : a-t-elle été payée avec une carte, et la séance
 * est-elle encore dans le délai d'annulation gratuite ? (La case « Recréditer la séance ».)
 */
export async function getCancelRecreditInfo(
  db: Executor,
  organizationId: string,
  bookingId: string,
) {
  const [row] = await db
    .select({
      paidWithPass: sql<boolean>`${booking.paymentStatus} = 'paid_with_pass'`,
      startsAt: sql<Date | null>`coalesce(${event.startsAt}, ${booking.rentalStartsAt})`,
      passName: sql<
        string | null
      >`(select p.name from pass_movement m join pass p on p.id = m.pass_id where m.booking_id = ${booking.id} and m.kind = 'use' limit 1)`,
      freeCancellationHours: tenantSettings.freeCancellationHours,
    })
    .from(booking)
    .leftJoin(event, eq(event.id, booking.eventId))
    .innerJoin(tenantSettings, eq(tenantSettings.organizationId, booking.organizationId))
    .where(and(eq(booking.organizationId, organizationId), eq(booking.id, bookingId)));
  return row ? { ...row, startsAt: row.startsAt ? new Date(row.startsAt) : null } : null;
}
