import type { PaymentDeps, PaymentGateway } from "@horaya/core";
import { env } from "../env";
import { deps } from "../services";
import { stripeEnabled, testGatewayEnabled } from "./config";
import { createStripeGateway } from "./stripe-gateway";
import { createTestGateway } from "./test-gateway";

export { integratedPaymentsEnabled } from "./config";

const globalForPayments = globalThis as unknown as { horayaGateway?: PaymentGateway | null };

/** Stripe si les clés sont là, la passerelle de test si demandée, sinon rien (liens de paiement). */
export const paymentGateway: PaymentGateway | null =
  globalForPayments.horayaGateway !== undefined
    ? globalForPayments.horayaGateway
    : env.STRIPE_SECRET_KEY && stripeEnabled
      ? createStripeGateway(env.STRIPE_SECRET_KEY)
      : testGatewayEnabled
        ? createTestGateway(env.BETTER_AUTH_URL)
        : null;
if (process.env.NODE_ENV !== "production") globalForPayments.horayaGateway = paymentGateway;

export const paymentDeps: PaymentDeps | null = paymentGateway
  ? { ...deps, payments: paymentGateway }
  : null;
export const testPayments = paymentGateway?.provider === "test";
