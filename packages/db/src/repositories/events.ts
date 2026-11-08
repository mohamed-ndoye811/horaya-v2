import {
  ConflictError,
  type Event,
  type EventRepository,
  type EventSeries,
  type EventType,
  type EventTypeRepository,
} from "@horaya/core";
import { and, asc, eq, gt, ne, notExists, sql } from "drizzle-orm";
import type { Executor } from "../client";
import { booking, event, eventSeries, eventType, member } from "../schema";

/** Nom déjà pris dans l'espace (contrainte unique organization_id + name). */
function duplicateName(error: unknown): never {
  const code =
    (error as { cause?: { code?: string } }).cause?.code ?? (error as { code?: string }).code;
  if (code === "23505") throw new ConflictError("Un type d'événement porte déjà ce nom");
  throw error;
}

export function eventTypeRepository(db: Executor): EventTypeRepository {
  return {
    async insert(values) {
      const [created] = await db.insert(eventType).values(values).returning().catch(duplicateName);
      return created as EventType;
    },

    async find(organizationId, eventTypeId) {
      const [found] = await db
        .select()
        .from(eventType)
        .where(and(eq(eventType.organizationId, organizationId), eq(eventType.id, eventTypeId)));
      return (found as EventType | undefined) ?? null;
    },

    async update(organizationId, eventTypeId, patch) {
      const [updated] = await db
        .update(eventType)
        .set(patch)
        .where(and(eq(eventType.organizationId, organizationId), eq(eventType.id, eventTypeId)))
        .returning()
        .catch(duplicateName);
      if (!updated) throw new Error(`Type d'événement introuvable : ${eventTypeId}`);
      return updated as EventType;
    },
  };
}

export function eventRepository(db: Executor): EventRepository {
  return {
    async insertSeries(values) {
      const [created] = await db
        .insert(eventSeries)
        .values(values)
        .returning({ id: eventSeries.id });
      if (!created) throw new Error("Série non créée");
      return created;
    },

    async findSeries(organizationId, seriesId) {
      const [found] = await db
        .select()
        .from(eventSeries)
        .where(and(eq(eventSeries.organizationId, organizationId), eq(eventSeries.id, seriesId)));
      return (found as EventSeries | undefined) ?? null;
    },

    async updateSeries(organizationId, seriesId, patch) {
      const [updated] = await db
        .update(eventSeries)
        .set(patch)
        .where(and(eq(eventSeries.organizationId, organizationId), eq(eventSeries.id, seriesId)))
        .returning();
      if (!updated) throw new Error(`Série introuvable : ${seriesId}`);
      return updated as EventSeries;
    },

    async listSeriesEvents(organizationId, seriesId) {
      const rows = await db
        .select()
        .from(event)
        .where(and(eq(event.organizationId, organizationId), eq(event.seriesId, seriesId)))
        .orderBy(asc(event.startsAt), asc(event.id));
      return rows as Event[];
    },

    async insert(values) {
      const [created] = await db
        .insert(event)
        .values(values)
        .returning()
        .catch((error: unknown) => {
          // Module Créneaux : intervenant ou créneau déjà pris (contraintes d'exclusion).
          const code =
            (error as { cause?: { code?: string } }).cause?.code ??
            (error as { code?: string }).code;
          if (code === "23P01") {
            throw new ConflictError("Ce créneau vient d'être pris : choisis-en un autre");
          }
          throw error;
        });
      return created as Event;
    },

    async find(organizationId, eventId) {
      const [found] = await db
        .select()
        .from(event)
        .where(and(eq(event.organizationId, organizationId), eq(event.id, eventId)));
      return (found as Event | undefined) ?? null;
    },

    async lockForBooking(organizationId, eventId) {
      const [found] = await db
        .select({ event, eventType })
        .from(event)
        .innerJoin(eventType, eq(eventType.id, event.eventTypeId))
        .where(and(eq(event.organizationId, organizationId), eq(event.id, eventId)))
        .for("update", { of: event });
      return found
        ? { event: found.event as Event, eventType: found.eventType as EventType }
        : null;
    },

    async update(organizationId, eventId, patch) {
      const [updated] = await db
        .update(event)
        .set(patch)
        .where(and(eq(event.organizationId, organizationId), eq(event.id, eventId)))
        .returning();
      if (!updated) throw new Error(`Événement introuvable : ${eventId}`);
      return updated as Event;
    },

    async slugExists(organizationId, slug) {
      const [found] = await db
        .select({ id: event.id })
        .from(event)
        .where(and(eq(event.organizationId, organizationId), eq(event.slug, slug)))
        .limit(1);
      return Boolean(found);
    },

    async memberBelongs(organizationId, memberId) {
      const [found] = await db
        .select({ id: member.id })
        .from(member)
        .where(and(eq(member.organizationId, organizationId), eq(member.id, memberId)));
      return Boolean(found);
    },

    async applyTypeConfig(organizationId, eventTypeId, { priceCents, ...config }, now) {
      const updated = await db
        .update(event)
        .set({
          ...config,
          // Chaque événement garde son acompte, lié à son mode de paiement.
          ...(config.modules && {
            modules: sql`(${JSON.stringify(config.modules)}::jsonb - 'deposit') || jsonb_strip_nulls(jsonb_build_object('deposit', ${event.modules} -> 'deposit'))`,
          }),
          ...(priceCents !== undefined && {
            priceCents: sql`CASE WHEN ${event.paymentMode} = 'free' THEN 0 ELSE ${priceCents}::int END`,
          }),
        })
        .where(
          and(
            eq(event.organizationId, organizationId),
            eq(event.eventTypeId, eventTypeId),
            gt(event.startsAt, now),
            ne(event.status, "cancelled"),
            notExists(
              db.select({ one: sql`1` }).from(booking).where(eq(booking.eventId, event.id)),
            ),
          ),
        )
        .returning({ id: event.id });
      return updated.length;
    },
  };
}
