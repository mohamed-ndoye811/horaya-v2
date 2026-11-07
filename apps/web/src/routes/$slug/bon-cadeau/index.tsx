import { createFileRoute, getRouteApi } from "@tanstack/react-router";
import { GiftCardPurchase } from "@/features/public/gift-card-purchase";
import { getGiftCardPurchase } from "@/functions/gift-cards";

const layout = getRouteApi("/$slug");

/** « Offrir un bon cadeau » : introuvable si l'organisateur ne vend pas de bons. */
export const Route = createFileRoute("/$slug/bon-cadeau/")({
  loader: ({ params }) => getGiftCardPurchase({ data: params.slug }),
  head: () => ({ meta: [{ title: "Offrir un bon cadeau" }] }),
  component: () => {
    const { settings } = Route.useLoaderData();
    return <GiftCardPurchase workspace={layout.useLoaderData()} settings={settings} />;
  },
});
