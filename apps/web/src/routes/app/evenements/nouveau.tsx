import { createFileRoute } from "@tanstack/react-router";
import { NewEventPage } from "@/features/events/new-event-page";
import { getNewEvent, newEventSearch } from "@/functions/events";

export const Route = createFileRoute("/app/evenements/nouveau")({
  validateSearch: newEventSearch,
  loaderDeps: ({ search }) => search,
  loader: ({ deps }) => getNewEvent({ data: deps }),
  head: () => ({ meta: [{ title: "Nouvel événement · Horaya" }] }),
  component: () => <NewEventPage data={Route.useLoaderData()} />,
});
