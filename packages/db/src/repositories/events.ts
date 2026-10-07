import type { Event, EventRepository, EventType, EventTypeRepository } from "@horaya/core";
import { and, eq } from "drizzle-orm";
import type { Executor } from "../client";
import { event, eventSeries, eventType } from "../schema";

export function eventTypeRepository(db: Executor): EventTypeRepository {
  return {
    async insert(values) {
      const [created] = await db.insert(eventType).values(values).returning();
      return created as EventType;
    },

    async find(organizationId, eventTypeId) {
      const [found] = await db
        .select()
        .from(eventType)
        .where(and(eq(eventType.organizationId, organizationId), eq(eventType.id, eventTypeId)));
      return (found as EventType | undefined) ?? null;
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
