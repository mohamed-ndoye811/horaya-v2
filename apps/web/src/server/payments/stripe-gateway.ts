import type { PaymentGateway, StripeAccountStatus } from "@horaya/core";
import Stripe from "stripe";

/**
 * Stripe Connect : l'organisateur a son propre compte (tableau de bord Stripe complet, frais
 * et litiges à sa charge) et vend en direct ; Horaya crée les paiements pour son compte.
 */
export function createStripeGateway(secretKey: string): PaymentGateway & { client: Stripe } {
  const stripe = new Stripe(secretKey);
  const onAccount = (accountId: string) => ({ stripeAccount: accountId });

  return {
    provider: "stripe",
    client: stripe,

    async createAccount({ email, businessName }) {
      const account = await stripe.accounts.create({
        country: "FR",
        email,
        business_profile: { name: businessName },
        controller: {
          stripe_dashboard: { type: "full" },
          fees: { payer: "account" },
          losses: { payments: "stripe" },
        },
      });
      return { accountId: account.id };
    },

    async createOnboardingLink({ accountId, returnUrl, refreshUrl }) {
      const link = await stripe.accountLinks.create({
        account: accountId,
        return_url: returnUrl,
        refresh_url: refreshUrl,
        type: "account_onboarding",
      });
      return { url: link.url };
    },

    async getAccount(accountId) {
      const account = await stripe.accounts.retrieve(accountId);
      const status: StripeAccountStatus = account.charges_enabled
        ? "active"
        : account.requirements?.disabled_reason && account.details_submitted
          ? "restricted"
          : "pending";
      return {
        status,
        displayName:
          account.settings?.dashboard?.display_name ?? account.business_profile?.name ?? null,
      };
    },

    async createCheckout(input) {
      const session = await stripe.checkout.sessions.create(
        {
          mode: "payment",
          locale: "fr",
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
