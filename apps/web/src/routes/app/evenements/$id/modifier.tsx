import { createFileRoute } from "@tanstack/react-router";
import { EditEventPage } from "@/features/events/edit-event-page";
import { getEditEvent } from "@/functions/events";

export const Route = createFileRoute("/app/evenements/$id/modifier")({
  loader: ({ params }) => getEditEvent({ data: params.id }),
  head: () => ({ meta: [{ title: "Modifier l'événement · Horaya" }] }),
  component: () => <EditEventPage data={Route.useLoaderData()} />,
});
