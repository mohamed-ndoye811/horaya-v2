import { createFileRoute } from "@tanstack/react-router";
import { SlotPage } from "@/features/public/slot-page";
import { getSlotPage, slotSearch } from "@/functions/slots";

/** Maquette 9.6 : un type « sur rendez-vous » (?duree=…&semaine=AAAA-MM-JJ). */
export const Route = createFileRoute("/$slug/creneaux/$type/")({
  validateSearch: slotSearch,
  loaderDeps: ({ search }) => search,
  loader: ({ params, deps }) =>
    getSlotPage({ data: { slug: params.slug, typeId: params.type, search: deps } }),
  head: ({ loaderData }) => ({
    meta: [
      {
        title: loaderData
          ? `${loaderData.type.name} · ${loaderData.workspace.name}`
          : "Réserver un créneau",
      },
    ],
  }),
  component: Slots,
});

function Slots() {
  return <SlotPage slug={Route.useParams().slug} data={Route.useLoaderData()} />;
}
