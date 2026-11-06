"use server";

import {
  listBookings,
  listCustomers,
  listEvents,
  listNotifications,
  markNotificationsRead,
  tenantSettingsReader,
} from "@horaya/db";
import { formatDateTimeShort, formatRelativeDateTime, formatRelativeDay } from "@/lib/format";
import { db } from "@/server/db";
import { requireMember } from "@/server/services";

export interface SearchHit {
  href: string;
  title: string;
  detail: string;
  /** Événement : couverture, sinon couleur du type ; client : initiales. */
  image?: string | null;
  color?: string | null;
}

export interface SearchResults {
  events: SearchHit[];
  customers: SearchHit[];
  bookings: SearchHit[];
}

const plural = (count: number, word: string) => `${count} ${word}${count > 1 ? "s" : ""}`;

/** Recherche du notch (⌘K) : événements à venir et brouillons, clients, réservations. */
export async function searchWorkspace(query: string): Promise<SearchResults> {
  const search = query.trim();
  if (search.length < 2) return { events: [], customers: [], bookings: [] };
  const { organizationId } = await requireMember();
  const now = new Date();
  const [settings, upcoming, drafts, customers, bookings] = await Promise.all([
    tenantSettingsReader(db).get(organizationId),
    listEvents(db, organizationId, { tab: "published", now, search, limit: 4 }),
    listEvents(db, organizationId, { tab: "draft", now, search, limit: 2 }),
    listCustomers(db, organizationId, { segment: "all", now, search, limit: 3 }),
    listBookings(db, organizationId, { tab: "all", search, limit: 3 }),
  ]);
  const timeZone = settings.timezone;

  return {
    events: [...upcoming, ...drafts].slice(0, 4).map((event) => ({
      href: `/app/evenements/${event.id}`,
      title: event.title,
      detail: [
        formatDateTimeShort(event.startsAt, timeZone),
        event.status === "draft"
          ? "Brouillon"
          : event.capacity
            ? `${event.seatsHeld} / ${event.capacity}`
            : plural(event.seatsHeld, "place"),
      ].join(" · "),
      image: event.coverImageUrl,
      color: event.typeColor,
    })),
    customers: customers.map((customer) => ({
      href: `/app/clients/${customer.id}`,
      title: `${customer.firstName} ${customer.lastName}`,
      detail: [
        plural(customer.bookings, "réservation"),
        customer.lastVisit
          ? `dernière ${formatRelativeDay(customer.lastVisit, timeZone)}`
          : customer.email,
      ].join(" · "),
    })),
    bookings: bookings.map((booking) => ({
      href: `/app/reservations/${booking.id}`,
      title: `${booking.reference} · ${booking.customerName}`,
      detail: [
        booking.eventTitle ?? "Location",
        booking.eventStartsAt ? formatDateTimeShort(booking.eventStartsAt, timeZone) : null,
      ]
        .filter(Boolean)
        .join(" · "),
      color: booking.typeColor,
    })),
  };
}

export interface NotificationItem {
  id: string;
  title: string;
  body: string | null;
  link: string | null;
  when: string;
  unread: boolean;
}

/** Ouverture de la cloche : les dernières notifications, puis tout passe en lu. */
export async function openNotifications(): Promise<NotificationItem[]> {
  const { organizationId, memberId } = await requireMember();
  const [settings, rows] = await Promise.all([
    tenantSettingsReader(db).get(organizationId),
    listNotifications(db, memberId, 20),
  ]);
  if (rows.some((row) => row.readAt === null)) await markNotificationsRead(db, memberId);
  return rows.map((row) => ({
    id: row.id,
    title: row.title,
    body: row.body,
    link: row.link,
    when: formatRelativeDateTime(row.createdAt, settings.timezone),
    unread: row.readAt === null,
  }));
}
