import type { Event, EventType } from "./model";

export type NewEventType = Omit<EventType, "id" | "archivedAt">;
export type NewEvent = Omit<
  Event,
  "id" | "createdAt" | "updatedAt" | "publishedAt" | "cancelledAt" | "status" | "coverImageUrl"
>;
export type EventPatch = Partial<
  Omit<Event, "id" | "organizationId" | "eventTypeId" | "seriesId" | "createdAt" | "updatedAt">
>;

export interface EventTypeRepository {
  insert(eventType: NewEventType): Promise<EventType>;
  find(organizationId: string, eventTypeId: string): Promise<EventType | null>;
}

export interface EventRepository {
  insertSeries(series: {
    organizationId: string;
    rrule: string;
    until: Date | null;
    timezone: string;
  }): Promise<{ id: string }>;
  insert(event: NewEvent): Promise<Event>;
  find(organizationId: string, eventId: string): Promise<Event | null>;
  /**
   * Charge l'événement et le verrouille (SELECT … FOR UPDATE) jusqu'à la fin de la
   * transaction : toutes les écritures qui touchent ses places passent par ce verrou.
   */
  lockForBooking(
    organizationId: string,
    eventId: string,
  ): Promise<{ event: Event; eventType: EventType } | null>;
  update(organizationId: string, eventId: string, patch: EventPatch): Promise<Event>;
  slugExists(organizationId: string, slug: string): Promise<boolean>;
}
