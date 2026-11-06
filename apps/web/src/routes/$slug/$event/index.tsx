import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { PublicEventPage } from "@/features/public/event-page";
import { getPublicEventPage } from "@/functions/public";
import { searchText } from "@/lib/search-params";

/** Maquette 5.2 : page publique d'un événement (?lien=… : arrivé par un lien calendrier). */
export const Route = createFileRoute("/$slug/$event/")({
  validateSearch: z.object({ lien: searchText }),
  loaderDeps: ({ search }) => ({ lien: search.lien }),
  loader: ({ params, deps }) =>
    getPublicEventPage({ data: { slug: params.slug, event: params.event, lien: deps.lien } }),
  head: ({ loaderData }) => {
    if (!loaderData) return {};
    const { workspace, event } = loaderData;
    const description = event?.description.slice(0, 160);
    return {
      meta: [
        {
          title: event
            ? `${event.title} · ${workspace.name}`
            : `Événement introuvable · ${workspace.name}`,
        },
        ...(description ? [{ name: "description", content: description }] : []),
      ],
    };
  },
  component: () => <PublicEventPage data={Route.useLoaderData()} />,
});
