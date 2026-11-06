import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { ItemDetailPage } from "@/features/inventory/item-detail-page";
import { getItem } from "@/functions/inventory";

export const Route = createFileRoute("/app/materiel/$id/")({
  validateSearch: z.object({ du: z.string().optional() }),
  loaderDeps: ({ search }) => search,
  loader: ({ params, deps }) => getItem({ data: { id: params.id, du: deps.du } }),
  head: () => ({ meta: [{ title: "Article · Horaya" }] }),
  component: () => <ItemDetailPage data={Route.useLoaderData()} />,
});
