/**
 * Abonnement d'agenda personnel d'un membre : un flux ICS des événements de l'espace,
 * à une adresse secrète (horaya.app/agenda/<jeton>.ics) qu'il peut régénérer.
 */
export interface CalendarFeed {
  id: string;
  organizationId: string;
  memberId: string;
  /** Gardé en clair (comme le lien d'invitation) : le membre doit pouvoir recopier l'adresse. */
  token: string;
  createdAt: Date;
}
