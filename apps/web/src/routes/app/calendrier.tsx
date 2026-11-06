import { createFileRoute } from "@tanstack/react-router";
import { CalendarPage } from "@/features/calendar/calendar-page";
import { calendarSearch, getCalendar } from "@/functions/calendar";

export const Route = createFileRoute("/app/calendrier")({
  validateSearch: calendarSearch,
  loaderDeps: ({ search }) => search,
  loader: ({ deps }) => getCalendar({ data: deps }),
  head: () => ({ meta: [{ title: "Calendrier · Horaya" }] }),
  component: Calendar,
});

function Calendar() {
  return <CalendarPage data={Route.useLoaderData()} view={Route.useSearch().vue ?? "mois"} />;
}
