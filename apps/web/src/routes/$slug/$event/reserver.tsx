import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { BookEventPage } from "@/features/public/book-event-page";
import { getBookEventPage } from "@/functions/public";
import { searchText } from "@/lib/search-params";

/** Maquette 5.3 : coordonnées des participants et paiement (?places=2&lien=…). */
export const Route = createFileRoute("/$slug/$event/reserver")({
  validateSearch: z.object({ lien: searchText, places: searchText }),
  loaderDeps: ({ search }) => search,
  loader: ({ params, deps }) =>
    getBookEventPage({ data: { slug: params.slug, event: params.event, ...deps } }),
  head: () => ({
    meta: [{ title: "Réserver tes places" }, { name: "robots", content: "noindex" }],
  }),
  component: BookEvent,
});

function BookEvent() {
  return <BookEventPage eventSlug={Route.useParams().event} data={Route.useLoaderData()} />;
}
