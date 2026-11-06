import { createFileRoute } from "@tanstack/react-router";
import { CalendarLinksPage } from "@/features/events/calendar-links-page";
import { getCalendarLinks } from "@/functions/events";

export const Route = createFileRoute("/app/evenements/liens")({
  loader: () => getCalendarLinks(),
  head: () => ({ meta: [{ title: "Liens calendrier · Horaya" }] }),
  component: () => <CalendarLinksPage data={Route.useLoaderData()} />,
});
