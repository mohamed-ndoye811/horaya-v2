/** Recherche du notch et notifications : logique serveur (voir functions/notch.ts). */
import {
  countPendingBookings,
  countUnreadNotifications,
  listBookings,
  listCustomers,
  listEvents,
  listItems,
  listNotifications,
  listNotificationsSince,
  markNotificationsRead,
  tenantSettingsReader,
} from "@horaya/db";
import { formatDateTimeShort, formatRelativeDateTime, formatRelativeDay } from "@/lib/format";
import { db } from "./db";
import { requireMember } from "./services";

export interface SearchHit {
  href: string;
  title: string;
  detail: string;
  /** Événement : couverture, sinon couleur du type ; matériel : photo ; client : initiales. */
  image?: string | null;
  color?: string | null;
}

export interface SearchResults {
  events: SearchHit[];
  items: SearchHit[];
  customers: SearchHit[];
  bookings: SearchHit[];
}

const plural = (count: number, word: string) => `${count} ${word}${count > 1 ? "s" : ""}`;

/**
 * Recherche du notch (⌘K) : événements à venir et brouillons, matériel, clients, réservations.
 * Sans recherche, des raccourcis : les réservations à valider et les prochains événements.
 */
export async function searchWorkspace(query: string): Promise<SearchResults> {
  const search = query.trim();
  const { organizationId } = await requireMember();
  const now = new Date();
  const suggest = search.length < 2;
  const [settings, upcoming, drafts, items, customers, bookings] = await Promise.all([
    tenantSettingsReader(db).get(organizationId),
    listEvents(db, organizationId, {
      tab: "published",
      now,
      search: suggest ? undefined : search,
      limit: suggest ? 3 : 4,
    }),
    suggest ? [] : listEvents(db, organizationId, { tab: "draft", now, search, limit: 2 }),
    suggest ? [] : listItems(db, organizationId, { tab: "all", now, search }),
    suggest ? [] : listCustomers(db, organizationId, { segment: "all", now, search, limit: 3 }),
    listBookings(
      db,
      organizationId,
      suggest ? { tab: "pending", limit: 3 } : { tab: "all", search, limit: 3 },
    ),
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
            : plural(event.seatsHeld, "inscrit"),
      ].join(" · "),
      image: event.coverImageUrl,
      color: event.typeColor,
    })),
    // listItems n'a pas de limite : on garde les 3 premiers (ordre alphabétique).
    items: items.slice(0, 3).map((row) => ({
      href: `/app/materiel/${row.id}`,
      title: row.name,
      detail: `Réf. ${row.reference} · ${row.availableNow} / ${row.units} disponible${row.availableNow > 1 ? "s" : ""}`,
      image: row.photoUrl,
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

export interface LiveShell {
  /** Heure du serveur : le prochain passage repart d'ici (pas de l'horloge du navigateur). */
  now: string;
  pendingBookings: number;
  unreadNotifications: number;
  /** Notifications arrivées depuis le dernier passage, à montrer sous le notch. */
  fresh: { id: string; type: string; message: string; link: string | null }[];
}

/** Coque de l'admin en direct : compteurs et nouvelles notifications depuis `since`. */
export async function pollShell(since: Date): Promise<LiveShell> {
  const { organizationId, memberId } = await requireMember();
  const now = new Date();
  const [pendingBookings, unreadNotifications, fresh] = await Promise.all([
    countPendingBookings(db, organizationId),
    countUnreadNotifications(db, memberId),
    listNotificationsSince(db, memberId, since),
  ]);
  return {
    now: now.toISOString(),
    pendingBookings,
    unreadNotifications,
    fresh: fresh.map((row) => ({
      id: row.id,
      type: row.type,
      message: row.body ? `${row.title} · ${row.body}` : row.title,
      link: row.link,
    })),
  };
}
