import type { PaymentGateway, StripeAccountStatus } from "@horaya/core";
import Stripe from "stripe";

/**
 * Stripe Connect, modèle « SaaS » : l'organisateur a son propre compte (Accounts v2, tableau de
 * bord Stripe complet, frais et pertes chez Stripe) et vend en direct (« direct charges ») ;
 * Horaya crée les paiements pour son compte.
 */
/** Étiquette des sessions Checkout dans le tableau de bord Stripe (suffixe de 8 lettres). */
const INTEGRATION_SUFFIX = "hrybkngx";

export function createStripeGateway(secretKey: string): PaymentGateway & { client: Stripe } {
  const stripe = new Stripe(secretKey);
  const onAccount = (accountId: string) => ({ stripeAccount: accountId });

  return {
    provider: "stripe",
    client: stripe,

    async createAccount({ email, businessName }) {
      const account = await stripe.v2.core.accounts.create({
        contact_email: email,
        display_name: businessName,
        dashboard: "full",
        identity: { country: "fr" },
        defaults: {
          currency: "eur",
          locales: ["fr-FR"],
          responsibilities: { fees_collector: "stripe", losses_collector: "stripe" },
        },
        configuration: { merchant: { capabilities: { card_payments: { requested: true } } } },
        include: ["configuration.merchant", "identity"],
      });
      return { accountId: account.id };
    },

    async createOnboardingLink({ accountId, returnUrl, refreshUrl }) {
      const link = await stripe.v2.core.accountLinks.create({
        account: accountId,
        use_case: {
          type: "account_onboarding",
          account_onboarding: { refresh_url: refreshUrl, return_url: returnUrl },
        },
      });
      return { url: link.url };
    },

    async getAccount(accountId) {
      const account = await stripe.v2.core.accounts.retrieve(accountId, {
        include: ["configuration.merchant"],
      });
      // Prêt à encaisser : capacité « paiements par carte » active (et non les champs v1 charges_enabled).
      const card = account.configuration?.merchant?.capabilities?.card_payments?.status;
      const status: StripeAccountStatus =
        card === "active"
          ? "active"
          : card === "restricted" || card === "rejected"
            ? "restricted"
            : "pending";
      return { status, displayName: account.display_name ?? null };
    },

    async createCheckout(input) {
      const session = await stripe.checkout.sessions.create(
        {
          mode: "payment",
          locale: "fr",
          integration_identifier: `horaya_reservation_${INTEGRATION_SUFFIX}`,
          customer_email: input.customerEmail || undefined,
          client_reference_id: input.bookingId,
          line_items: [
            {
              quantity: 1,
              price_data: {
                currency: input.currency.toLowerCase(),
                unit_amount: input.amountCents,
                product_data: { name: input.description },
              },
            },
          ],
          metadata: { bookingId: input.bookingId, reference: input.reference },
          payment_intent_data: {
            metadata: { bookingId: input.bookingId, reference: input.reference },
          },
          success_url: input.successUrl,
          cancel_url: input.cancelUrl,
          expires_at: Math.floor(input.expiresAt.getTime() / 1000),
        },
        onAccount(input.accountId),
      );
      if (!session.url) throw new Error("Stripe n'a pas renvoyé de page de paiement");
      return { checkoutId: session.id, url: session.url };
    },

    async refund({ accountId, paymentReference, amountCents }) {
      const refund = await stripe.refunds.create(
        { payment_intent: paymentReference, amount: amountCents },
        onAccount(accountId),
      );
      return { refundId: refund.id };
    },

    async getBalance(accountId) {
      const [balance, payouts] = await Promise.all([
        stripe.balance.retrieve({}, onAccount(accountId)),
        stripe.payouts.list({ limit: 1, status: "pending" }, onAccount(accountId)),
      ]);
      const sum = (entries: Array<{ amount: number; currency: string }>) =>
        entries
          .filter((entry) => entry.currency === "eur")
          .reduce((total, entry) => total + entry.amount, 0);
      const next = payouts.data[0];
      return {
        availableCents: sum(balance.available),
        pendingCents: sum(balance.pending),
        nextPayoutAt: next ? new Date(next.arrival_date * 1000) : null,
        nextPayoutCents: next?.amount ?? null,
      };
    },
  };
}
