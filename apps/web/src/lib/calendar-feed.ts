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

export interface CustomerFeedBooking {
  id: string;
  title: string;
  status: string;
  startsAt: Date;
  endsAt: Date;
  locationName: string | null;
  reference: string;
  workspaceName: string;
  /** Page de la réservation dans l'espace client. */
  url: string;
}

/**
 * Agenda personnel d'un client (espace client, lot 29) : ses réservations, actives ou annulées
 * (l'agenda abonné retire alors le cours). Même UID que le fichier .ics d'une réservation.
 */
export function customerFeedIcs(feed: {
  name: string;
  bookings: CustomerFeedBooking[];
  now?: Date;
}): string {
  return buildIcsCalendar({
    organizer: feed.name,
    name: feed.name,
    now: feed.now,
    events: feed.bookings.map((booking) => ({
      uid: `${booking.id}@horaya.app`,
      title: booking.title,
      startsAt: booking.startsAt,
      endsAt: booking.endsAt,
      location: booking.locationName,
      description: `Réservation ${booking.reference} · ${booking.workspaceName}`,
      url: booking.url,
      cancelled: booking.status === "cancelled" || booking.status === "refused",
    })),
  });
}
