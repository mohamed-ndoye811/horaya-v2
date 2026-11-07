import type { CalendarFeed } from "./model";

export interface CalendarFeedRepository {
  /** Flux du membre, créé avec ce jeton s'il n'existe pas encore. */
  ensure(organizationId: string, memberId: string, token: string): Promise<CalendarFeed>;
  /** Crée le flux ou remplace son jeton : l'ancienne adresse cesse aussitôt de marcher. */
  replaceToken(organizationId: string, memberId: string, token: string): Promise<CalendarFeed>;
}
