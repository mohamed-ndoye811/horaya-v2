import { completeCheckout, expireCheckout, refreshPaymentAccount } from "@horaya/core";
import { findOrganizationByPaymentAccount } from "@horaya/db";
import Stripe from "stripe";
import { db } from "@/server/db";
import { env } from "@/server/env";
import { paymentDeps, paymentGateway } from "@/server/payments";

/**
 * Événements Stripe (comptes connectés compris) : paiement réussi, page expirée, compte mis à
 * jour. Signature vérifiée ; chaque traitement est idempotent (Stripe peut renvoyer un événement).
 */
export async function POST(request: Request) {
  if (
    paymentGateway.provider !== "stripe" ||
    !env.STRIPE_SECRET_KEY ||
    !env.STRIPE_WEBHOOK_SECRET
  ) {
    return new Response("Webhook Stripe non configuré", { status: 404 });
  }
  const stripe = new Stripe(env.STRIPE_SECRET_KEY);
  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(
      await request.text(),
      request.headers.get("stripe-signature") ?? "",
      env.STRIPE_WEBHOOK_SECRET,
    );
  } catch {
    return new Response("Signature invalide", { status: 400 });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed":
      case "checkout.session.async_payment_succeeded": {
        const session = event.data.object;
        if (session.payment_status === "paid" && typeof session.payment_intent === "string") {
          await completeCheckout(paymentDeps, "stripe", session.id, session.payment_intent);
        }
        break;
      }
      case "checkout.session.expired":
      case "checkout.session.async_payment_failed":
        await expireCheckout(paymentDeps, "stripe", event.data.object.id);
        break;
      case "account.updated": {
        const organizationId = await findOrganizationByPaymentAccount(db, event.data.object.id);
        if (organizationId) await refreshPaymentAccount(paymentDeps, organizationId);
        break;
      }
    }
  } catch (error) {
    console.error("Webhook Stripe", event.type, error);
    // 500 : Stripe réessaiera plus tard.
    return new Response("Erreur de traitement", { status: 500 });
  }
  return Response.json({ received: true });
}
