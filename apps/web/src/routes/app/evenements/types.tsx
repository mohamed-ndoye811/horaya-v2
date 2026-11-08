import { createFileRoute } from "@tanstack/react-router";
import { EventTypeEditor } from "@/features/events/event-type-editor";
import { EventTypesPage } from "@/features/events/event-types-page";
import { eventTypesSearch, getEventTypes } from "@/functions/events";

export const Route = createFileRoute("/app/evenements/types")({
  validateSearch: eventTypesSearch,
  // Une clé par type ouvert : après un enregistrement, la liste est relue avant l'affichage.
  loaderDeps: ({ search }) => search,
  loader: ({ deps }) => getEventTypes({ data: deps }),
  head: ({ loaderData }) => ({
    meta: [
      {
        title: `${loaderData?.editor ? loaderData.editor.name || "Nouveau type" : "Types d'événements"} · Horaya`,
      },
    ],
  }),
  component: EventTypes,
});

function EventTypes() {
  const data = Route.useLoaderData();
  const search = Route.useSearch();
  // Un type ouvert (ou un nouveau, d'après un modèle) : l'éditeur prend toute la page.
  return data.editor ? (
    <EventTypeEditor
      key={`${search.type}-${search.modele ?? ""}-${search.depuis ?? ""}`}
      initial={data.editor}
      workspaceName={data.workspaceName}
    />
  ) : (
    <EventTypesPage data={data} choosing={search.type === "nouveau"} />
  );
}
