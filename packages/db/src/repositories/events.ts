import {
  ConflictError,
  type Event,
  type EventRepository,
  type EventType,
  type EventTypeRepository,
} from "@horaya/core";
import { and, eq } from "drizzle-orm";
import type { Executor } from "../client";
import { event, eventSeries, eventType } from "../schema";

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

    async insert(values) {
      const [created] = await db.insert(event).values(values).returning();
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
  };
}
