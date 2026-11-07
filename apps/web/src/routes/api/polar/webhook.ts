import { applySubscription, endSubscription, organizationOfPolarCustomer } from "@horaya/core";
import { webhooks } from "@polar-sh/sdk/2026-10";
import { createFileRoute } from "@tanstack/react-router";
import { planOfProduct, subscriptionStatusOf } from "@/server/billing";
import { env } from "@/server/env";
import { deps } from "@/server/services";

/**
 * Événements Polar des abonnements Horaya. Signature vérifiée ; traitement idempotent (Polar
 * peut renvoyer un événement) : chaque événement réécrit l'état complet de l'abonnement.
 */
export const Route = createFileRoute("/api/polar/webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        if (!env.POLAR_WEBHOOK_SECRET) {
          return new Response("Webhook Polar non configuré", { status: 404 });
        }
        let event: webhooks.WebhookPayload;
        try {
          event = await webhooks.validateEvent(
            await request.text(),
            Object.fromEntries(request.headers),
            env.POLAR_WEBHOOK_SECRET,
          );
        } catch (error) {
          if (error instanceof webhooks.PolarWebhookUnknownTypeError) {
            return Response.json({ received: true });
          }
          return new Response("Signature invalide", { status: 403 });
        }
        if (!event.type.startsWith("subscription.")) return Response.json({ received: true });

        const subscription = event.data as {
          id: string;
          status: string;
          customer_id: string;
          product_id: string;
          current_period_end: string | null;
          cancel_at_period_end: boolean;
          metadata: Record<string, unknown>;
          customer: { external_id?: string | null };
        };
        try {
          const product = planOfProduct(subscription.product_id);
          const fromMetadata = subscription.metadata.organization_id;
          const organizationId =
            (typeof fromMetadata === "string" ? fromMetadata : null) ??
            subscription.customer.external_id ??
            (await organizationOfPolarCustomer(deps, subscription.customer_id));
          if (!organizationId) {
            console.error("Webhook Polar : abonnement non rattaché", subscription.id);
            return Response.json({ received: true });
          }
          // Produit hors Horaya (ex. changement de formule vers une autre app de l'organisation
          // Polar) : la formule Horaya ne reste pas active sans être payée.
          if (!product) {
            const ended = await endSubscription(deps, organizationId, subscription.id);
            console.error("Webhook Polar : produit inconnu", subscription.product_id, { ended });
            return Response.json({ received: true });
          }
          await applySubscription(deps, organizationId, {
            ...product,
            status:
              event.type === "subscription.revoked"
                ? "canceled"
                : subscriptionStatusOf(subscription.status),
            polarCustomerId: subscription.customer_id,
            polarSubscriptionId: subscription.id,
            // Révoqué : l'accès s'arrête tout de suite, pas à la fin de la période.
            currentPeriodEnd:
              event.type === "subscription.revoked" || !subscription.current_period_end
                ? new Date()
                : new Date(subscription.current_period_end),
            cancelAtPeriodEnd: subscription.cancel_at_period_end,
          });
        } catch (error) {
          console.error("Webhook Polar", event.type, error);
          // 500 : Polar réessaiera plus tard.
          return new Response("Erreur de traitement", { status: 500 });
        }
        return Response.json({ received: true });
      },
    },
  },
});
