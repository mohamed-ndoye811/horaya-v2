import type { CalendarLink } from "./model";

export type NewCalendarLink = Omit<CalendarLink, "id" | "createdAt" | "updatedAt">;
export type CalendarLinkPatch = Partial<
  Pick<CalendarLink, "name" | "filterMode" | "filterIds" | "isActive">
>;

export interface CalendarLinkRepository {
  insert(link: NewCalendarLink): Promise<CalendarLink>;
  find(organizationId: string, linkId: string): Promise<CalendarLink | null>;
  findBySlug(organizationId: string, slug: string): Promise<CalendarLink | null>;
  update(organizationId: string, linkId: string, patch: CalendarLinkPatch): Promise<CalendarLink>;
  delete(organizationId: string, linkId: string): Promise<void>;
  /** Vérifie que les types ou les événements choisis appartiennent bien à l'espace. */
  countOwned(
    organizationId: string,
    kind: "event_types" | "events",
    ids: string[],
  ): Promise<number>;
}
