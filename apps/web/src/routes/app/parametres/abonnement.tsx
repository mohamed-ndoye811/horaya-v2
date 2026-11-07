import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { BillingSettingsPage } from "@/features/settings/billing-page";
import { getBillingSettings } from "@/functions/billing";

export const Route = createFileRoute("/app/parametres/abonnement")({
  validateSearch: z.object({ paiement: z.literal("ok").optional() }),
  loader: () => getBillingSettings(),
  head: () => ({ meta: [{ title: "Abonnement · Horaya" }] }),
  component: function Abonnement() {
    const { paiement } = Route.useSearch();
    return <BillingSettingsPage data={Route.useLoaderData()} paid={paiement === "ok"} />;
  },
});
