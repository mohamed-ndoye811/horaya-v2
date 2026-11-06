import { addDays } from "@horaya/core";
import {
  countEventsStartingBetween,
  getDashboardOverview,
  getDashboardStats,
  getWorkspaceSettings,
  listEventTypes,
  listLatestBookings,
  listUpcomingEvents,
} from "@horaya/db";
import { createServerFn } from "@tanstack/react-start";
import { addMonths, mondayOf, startOfDay, todayIn } from "@/lib/dates";
import { db } from "@/server/db";
import { getWorkspaceContext } from "@/server/workspace";

/** Données de l'écran 03 (tableau de bord), lues en une fois. */
export const getDashboard = createServerFn({ method: "GET" }).handler(async () => {
  const { user, workspace, timeZone } = await getWorkspaceContext();
  const now = new Date();
  const today = todayIn(timeZone, now);
  const monday = mondayOf(today);
  const monthStart = startOfDay({ ...today, day: 1 }, timeZone);
  const previousMonthStart = startOfDay(addMonths(today, -1), timeZone);
  const dayStart = startOfDay(today, timeZone);
  const dayEnd = startOfDay(addDays(today, 1), timeZone);

  const [stats, overview, upcoming, latest, startingToday, types, settings] = await Promise.all([
    getDashboardStats(db, workspace.id, {
      now,
      weekStart: startOfDay(monday, timeZone),
      weekEnd: startOfDay(addDays(monday, 7), timeZone),
      previousWeekStart: startOfDay(addDays(monday, -7), timeZone),
      monthStart,
    }),
    getDashboardOverview(db, workspace.id, {
      now,
      dayStart,
      dayEnd,
      monthStart,
      previousMonthStart,
      // Même avancée dans le mois précédent (du 1er au même jour, même heure).
      previousMonthSameMoment: new Date(
        previousMonthStart.getTime() + (now.getTime() - monthStart.getTime()),
      ),
      timeZone,
    }),
    listUpcomingEvents(db, workspace.id, now, 8),
    // Trois, comme la maquette : tout le tableau de bord tient sans défiler.
    listLatestBookings(db, workspace.id, 3),
    countEventsStartingBetween(db, workspace.id, dayStart, dayEnd),
    listEventTypes(db, workspace.id),
    getWorkspaceSettings(db, workspace.id),
  ]);

  return {
    user: {
      name: user.name,
      firstName: user.firstName as string | null | undefined,
      email: user.email,
      emailVerified: user.emailVerified,
    },
    workspace: { name: workspace.name, slug: workspace.slug },
    timeZone,
    now,
    stats,
    overview,
    upcoming,
    latest,
    startingToday,
    types,
    paymentLinkUrl: settings?.paymentLinkUrl ?? null,
  };
});
