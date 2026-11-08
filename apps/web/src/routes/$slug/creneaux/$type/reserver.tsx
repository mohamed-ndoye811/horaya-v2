import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { SlotBookPage } from "@/features/public/slot-book-page";
import { getSlotBookPage } from "@/functions/slots";
import { searchText } from "@/lib/search-params";

/** Le formulaire d'un créneau gardé 10 minutes (?creneau=…). */
export const Route = createFileRoute("/$slug/creneaux/$type/reserver")({
  validateSearch: z.object({ creneau: searchText }),
  loaderDeps: ({ search }) => search,
  loader: ({ params, deps }) =>
    getSlotBookPage({ data: { slug: params.slug, typeId: params.type, holdId: deps.creneau } }),
  head: () => ({
    meta: [{ title: "Réserver ton créneau" }, { name: "robots", content: "noindex" }],
  }),
  component: SlotBook,
});

function SlotBook() {
  return <SlotBookPage data={Route.useLoaderData()} />;
}
