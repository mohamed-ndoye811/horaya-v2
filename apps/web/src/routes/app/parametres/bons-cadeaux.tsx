import { createFileRoute } from "@tanstack/react-router";
import { GiftCardSettingsPage } from "@/features/gift-cards/gift-card-settings-page";
import { getGiftCardSettings } from "@/functions/gift-cards";

export const Route = createFileRoute("/app/parametres/bons-cadeaux")({
  loader: () => getGiftCardSettings(),
  head: () => ({ meta: [{ title: "Bons cadeaux · Horaya" }] }),
  component: () => <GiftCardSettingsPage data={Route.useLoaderData()} />,
});
