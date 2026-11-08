import { createFileRoute } from "@tanstack/react-router";
import { GiftCardDetailPage } from "@/features/gift-cards/gift-card-detail-page";
import { getGiftCard } from "@/functions/gift-cards";

export const Route = createFileRoute("/app/bons-cadeaux/$id")({
  loader: ({ params }) => getGiftCard({ data: params.id }),
  head: () => ({ meta: [{ title: "Bon cadeau · Horaya" }] }),
  component: () => <GiftCardDetailPage data={Route.useLoaderData()} />,
});
