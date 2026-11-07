import { createFileRoute } from "@tanstack/react-router";
import { GiftCardsPage } from "@/features/gift-cards/gift-cards-page";
import { getGiftCards, giftCardsSearch } from "@/functions/gift-cards";

export const Route = createFileRoute("/app/bons-cadeaux/")({
  validateSearch: giftCardsSearch,
  loaderDeps: ({ search }) => search,
  loader: ({ deps }) => getGiftCards({ data: deps }),
  head: () => ({ meta: [{ title: "Bons cadeaux · Horaya" }] }),
  component: () => <GiftCardsPage data={Route.useLoaderData()} search={Route.useSearch().q} />,
});
