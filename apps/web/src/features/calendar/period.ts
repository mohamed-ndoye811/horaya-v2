import { addDays } from "@horaya/core";
import { type CivilDate, monthGrid } from "@/lib/calendar";
import { addMonths, mondayOf } from "@/lib/dates";

export type CalendarView = "mois" | "semaine" | "jour";

/** Jours affichés par la vue, et dates des périodes précédente et suivante. */
export function calendarPeriod(view: CalendarView, date: CivilDate) {
  if (view === "mois") {
    return {
      days: monthGrid(date.year, date.month).flat(),
      previous: addMonths(date, -1),
      next: addMonths(date, 1),
    };
  }
  if (view === "semaine") {
    const monday = mondayOf(date);
    return {
      days: Array.from({ length: 7 }, (_, offset) => addDays(monday, offset)),
      previous: addDays(monday, -7),
      next: addDays(monday, 7),
    };
  }
  return { days: [date], previous: addDays(date, -1), next: addDays(date, 1) };
}
