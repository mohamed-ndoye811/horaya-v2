import { addDays } from "@horaya/core";
import { getEventDetail, listEventStaff, listEventsInRange, listEventTypes } from "@horaya/db";
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { calendarPeriod } from "@/features/calendar/period";
import { parseCivilDate, startOfDay, todayIn } from "@/lib/dates";
import { searchText } from "@/lib/search-params";
import { db } from "@/server/db";
import { getWorkspaceContext } from "@/server/workspace";

/** Vue, jour et événement ouvert (vue jour), tels qu'ils sont dans l'adresse. */
export const calendarSearch = z.object({
  vue: z.enum(["mois", "semaine", "jour"]).optional().catch(undefined),
  date: searchText,
  evenement: z.uuid().optional().catch(undefined),
  intervenant: z.uuid().optional().catch(undefined),
});

/** Écrans 06 à 08 : événements de la période affichée, types (légende), événement ouvert. */
export const getCalendar = createServerFn({ method: "GET" })
  .validator(calendarSearch)
  .handler(async ({ data }) => {
    const { workspace, timeZone } = await getWorkspaceContext();
    const now = new Date();
    const today = todayIn(timeZone, now);
    const date = parseCivilDate(data.date) ?? today;
    const { days } = calendarPeriod(data.vue ?? "mois", date);
    const from = startOfDay(days[0] ?? date, timeZone);
    const to = startOfDay(addDays(days.at(-1) ?? date, 1), timeZone);
    const [rows, types, staff, selected] = await Promise.all([
      listEventsInRange(db, workspace.id, { from, to, staffMemberId: data.intervenant }),
      listEventTypes(db, workspace.id),
      listEventStaff(db, workspace.id),
      data.evenement ? getEventDetail(db, workspace.id, data.evenement) : null,
    ]);
    return {
      timeZone,
      now,
      today,
      date,
      workspaceName: workspace.name,
      rows,
      staff,
      staffFilter: data.intervenant,
      types: types.map((type) => ({ name: type.name, color: type.color })),
      selected: selected && {
        event: selected.event,
        bookings: selected.bookings.map((entry) => ({
          id: entry.id,
          customerName: entry.customerName,
          status: entry.status,
        })),
      },
    };
  });
