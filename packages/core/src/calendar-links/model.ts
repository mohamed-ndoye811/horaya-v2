/** Quels événements un lien calendrier montre : tous, certains types, ou une liste. */
export const CALENDAR_LINK_FILTERS = ["all", "event_types", "events"] as const;
export type CalendarLinkFilter = (typeof CALENDAR_LINK_FILTERS)[number];

/**
 * Lien calendrier : une page publique à part (horaya.app/<espace>/calendrier/<adresse>)
 * qui ne montre qu'une partie des événements. Il vaut invitation : les événements
 * « sur invitation » qu'il contient deviennent réservables par ceux qui ont le lien.
 */
export interface CalendarLink {
  id: string;
  organizationId: string;
  name: string;
  /** Adresse du lien, avec une partie aléatoire : elle ne se devine pas. */
  slug: string;
  filterMode: CalendarLinkFilter;
  /** Types d'événements ou événements retenus (vide pour « tous »). */
  filterIds: string[];
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}
