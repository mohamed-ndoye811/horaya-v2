import { buildIcsCalendar } from "./ics";

/** Période du flux d'agenda d'un membre : un mois en arrière, un an en avant. */
export const FEED_DAYS_BEFORE = 30;
export const FEED_DAYS_AFTER = 365;

export interface FeedEvent {
  id: string;
  title: string;
  status: string;
  startsAt: Date;
  endsAt: Date;
  locationName: string | null;
  locationAddress: string | null;
  onlineUrl: string | null;
  capacity: number | null;
  seatsHeld: number;
}

/** Flux ICS des événements de l'espace : aucune donnée de client, seulement le nombre d'inscrits. */
export function calendarFeedIcs(feed: {
  workspaceName: string;
  events: FeedEvent[];
  eventUrl: (eventId: string) => string;
  now?: Date;
}): string {
  return buildIcsCalendar({
    organizer: feed.workspaceName,
    name: `${feed.workspaceName} · Horaya`,
    now: feed.now,
    events: feed.events.map((event) => {
      const url = feed.eventUrl(event.id);
      const seats = `${event.seatsHeld} inscrit${event.seatsHeld > 1 ? "s" : ""}`;
      return {
        uid: `evenement-${event.id}@horaya.app`,
        title: event.title,
        startsAt: event.startsAt,
        endsAt: event.endsAt,
        location:
          [event.locationName, event.locationAddress].filter(Boolean).join(", ") || event.onlineUrl,
        description: [
          event.capacity ? `${seats} sur ${event.capacity} places` : seats,
          event.onlineUrl && `En ligne : ${event.onlineUrl}`,
          `Fiche dans Horaya : ${url}`,
        ]
          .filter(Boolean)
          .join("\n"),
        url,
        cancelled: event.status === "cancelled",
      };
    }),
  });
}
