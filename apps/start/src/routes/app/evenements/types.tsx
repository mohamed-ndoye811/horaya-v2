import { createFileRoute } from "@tanstack/react-router";
import { EventTypesPage } from "@/features/events/event-types-page";
import { eventTypesSearch, getEventTypes } from "@/functions/events";

export const Route = createFileRoute("/app/evenements/types")({
  validateSearch: eventTypesSearch,
  // Une clé par panneau ouvert : après un enregistrement, la liste est relue avant l'affichage.
  loaderDeps: ({ search }) => search,
  loader: () => getEventTypes(),
  head: () => ({ meta: [{ title: "Types d'événements · Horaya" }] }),
  component: EventTypes,
});

function EventTypes() {
  return <EventTypesPage data={Route.useLoaderData()} selected={Route.useSearch().type} />;
}
