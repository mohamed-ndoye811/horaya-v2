import { createFileRoute } from "@tanstack/react-router";
import { connectStripe, stripeReturn } from "@/server/settings";

/**
 * Stripe : POST depuis « Connecter Stripe » (vers l'activation chez Stripe), GET au retour de
 * l'activation (on relit l'état du compte, ou on relance un lien expiré).
 */
export const Route = createFileRoute("/app/parametres/paiements/stripe")({
  server: {
    handlers: {
      GET: ({ request }) => stripeReturn(request),
      POST: () => connectStripe(),
    },
  },
});
