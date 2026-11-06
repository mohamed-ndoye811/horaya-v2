import {
  type BookingTab,
  countBookingsByTab,
  listBookableEvents,
  listBookings,
  sumConfirmedBookingsSince,
} from "@horaya/db";
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { startOfDay, todayIn } from "@/lib/dates";
import { db } from "@/server/db";
import { getWorkspaceContext } from "@/server/workspace";

export const BOOKING_TABS = ["all", "pending", "confirmed", "waitlisted", "cancelled"] as const;

/** Filtres de l'écran 05, tels qu'ils sont dans l'adresse. */
export const bookingsSearch = z.object({
  statut: z.enum(BOOKING_TABS).optional().catch(undefined),
  q: z.string().optional(),
  evenement: z.string().optional(),
});

/** Données de l'écran 05 : réservations filtrées, compteurs des onglets, montant du mois. */
export const getBookings = createServerFn({ method: "GET" })
  .validator(bookingsSearch)
  .handler(async ({ data }) => {
    const { workspace, timeZone } = await getWorkspaceContext();
    const tab: BookingTab = data.statut ?? "all";
    const today = todayIn(timeZone);
    const [counts, bookings, events, monthAmount] = await Promise.all([
      countBookingsByTab(db, workspace.id),
      listBookings(db, workspace.id, { tab, search: data.q, eventId: data.evenement }),
      listBookableEvents(db, workspace.id, new Date()),
      sumConfirmedBookingsSince(db, workspace.id, startOfDay({ ...today, day: 1 }, timeZone)),
    ]);
    return {
      timeZone,
      today,
      counts,
      bookings,
      events: events.map((event) => ({ id: event.id, title: event.title })),
      monthAmount,
    };
  });
