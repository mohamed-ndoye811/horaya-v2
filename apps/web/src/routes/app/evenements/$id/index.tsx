import { createFileRoute } from "@tanstack/react-router";
import { EventDetailPage } from "@/features/events/event-detail-page";
import { eventSearch, getEvent } from "@/functions/events";

export const Route = createFileRoute("/app/evenements/$id/")({
  validateSearch: eventSearch,
  loaderDeps: ({ search }) => search,
  loader: ({ params, deps }) => getEvent({ data: { id: params.id, onglet: deps.onglet } }),
  head: () => ({ meta: [{ title: "Événement · Horaya" }] }),
  component: EventDetail,
});

function EventDetail() {
  const { onglet } = Route.useSearch();
  return <EventDetailPage data={Route.useLoaderData()} tab={onglet ?? "participants"} />;
}
