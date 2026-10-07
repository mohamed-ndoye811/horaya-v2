export interface CalendarEvent {
  id: string;
  title: string;
  startsAt: Date;
  endsAt: Date;
  /** Couleur du type d'événement. */
  color: string;
  /** Ligne d'info sous le titre dans les grands blocs (« Pot's · 6 / 8 places »). */
  detail?: string;
  href?: string;
}

export const WEEKDAY_LABELS = ["Lun.", "Mar.", "Mer.", "Jeu.", "Ven.", "Sam.", "Dim."] as const;
