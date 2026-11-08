import type { EventTypeField } from "../fields/model";
import type { EventModules } from "../modules/registry";
import type { Rule } from "../rules/model";
import type { Event, EventSeries, EventType } from "./model";

export type NewEventType = Omit<EventType, "id" | "archivedAt">;
export type NewEvent = Omit<
  Event,
  | "id"
  | "createdAt"
  | "updatedAt"
  | "publishedAt"
  | "cancelledAt"
  | "status"
  | "coverImageUrl"
  | "fromSlot"
  | "sessionTopic"
> &
  Partial<Pick<Event, "fromSlot" | "sessionTopic">>;
export type EventPatch = Partial<
  Omit<
    Event,
    "id" | "organizationId" | "eventTypeId" | "seriesId" | "fields" | "createdAt" | "updatedAt"
  >
>;

export type SeriesEnrollmentSettings = Pick<
  EventSeries,
  | "enrollmentEnabled"
  | "enrollmentPriceCents"
  | "enrollmentPrices"
  | "sameEquipment"
  | "dropInAllowed"
  | "enrollmentProrata"
  | "makeupAllowed"
>;

export type EventTypePatch = Partial<Omit<EventType, "id" | "organizationId">>;

export interface EventTypeRepository {
  insert(eventType: NewEventType): Promise<EventType>;
  find(organizationId: string, eventTypeId: string): Promise<EventType | null>;
  update(organizationId: string, eventTypeId: string, patch: EventTypePatch): Promise<EventType>;
}

export interface EventRepository {
  insertSeries(
    series: {
      organizationId: string;
      rrule: string;
      until: Date | null;
      timezone: string;
      kind?: EventSeries["kind"];
    } & Partial<SeriesEnrollmentSettings>,
  ): Promise<{ id: string }>;
  findSeries(organizationId: string, seriesId: string): Promise<EventSeries | null>;
  updateSeries(
    organizationId: string,
    seriesId: string,
    patch: Partial<SeriesEnrollmentSettings>,
  ): Promise<EventSeries>;
  /** Occurrences d'une série, la plus proche d'abord (tous statuts). */
  listSeriesEvents(organizationId: string, seriesId: string): Promise<Event[]>;
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
  /** Le membre fait-il partie de l'espace (module Intervenant) ? */
  memberBelongs(organizationId: string, memberId: string): Promise<boolean>;
  /**
   * « Appliquer aussi aux événements à venir » : remplace les champs, modules et règles des
   * événements du type qui n'ont pas commencé, ne sont pas annulés et n'ont aucune réservation.
   * Chaque événement garde son acompte (lié à son mode de paiement) ; `priceCents` : prix du
   * tarif par défaut du type, repris par les événements payants. Renvoie leur nombre.
   */
  applyTypeConfig(
    organizationId: string,
    eventTypeId: string,
    config: {
      fields?: EventTypeField[];
      modules?: EventModules;
      priceCents?: number;
      rules?: Rule[];
    },
    now: Date,
  ): Promise<number>;
}
