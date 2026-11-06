import { createFileRoute } from "@tanstack/react-router";
import { EventsPage } from "@/features/events/events-page";
import { eventsSearch, getEvents } from "@/functions/events";

export const Route = createFileRoute("/app/evenements/")({
  validateSearch: eventsSearch,
  loaderDeps: ({ search }) => search,
  loader: ({ deps }) => getEvents({ data: deps }),
  head: () => ({ meta: [{ title: "Événements · Horaya" }] }),
  component: Events,
});

function Events() {
  return <EventsPage data={Route.useLoaderData()} filters={Route.useSearch()} />;
}
