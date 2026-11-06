import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { PaymentsSettingsPage } from "@/features/settings/payments-page";
import { getPaymentsSettings } from "@/functions/settings";

export const Route = createFileRoute("/app/parametres/paiements/")({
  validateSearch: z.object({ stripe: z.string().optional() }),
  loader: () => getPaymentsSettings(),
  head: () => ({ meta: [{ title: "Paiements & notifications · Horaya" }] }),
  component: () => (
    <PaymentsSettingsPage
      data={Route.useLoaderData()}
      stripeError={Route.useSearch().stripe === "erreur"}
    />
  ),
});
