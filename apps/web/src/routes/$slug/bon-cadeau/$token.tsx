import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { GiftCardView } from "@/features/public/gift-card-view";
import { getGiftCardView } from "@/functions/gift-cards";

/** Le bon, retrouvé par son jeton : confirmation après l'achat, puis page imprimable. */
export const Route = createFileRoute("/$slug/bon-cadeau/$token")({
  validateSearch: z.object({ nouveau: z.string().optional() }),
  loader: ({ params }) => getGiftCardView({ data: { slug: params.slug, token: params.token } }),
  head: () => ({ meta: [{ title: "Bon cadeau" }, { name: "robots", content: "noindex" }] }),
  component: () => (
    <GiftCardView data={Route.useLoaderData()} justPurchased={Route.useSearch().nouveau === "1"} />
  ),
});
