import type { PaymentDeps } from "@horaya/core";
import { env } from "../env";
import { deps } from "../services";
import { createStripeGateway } from "./stripe-gateway";
import { createTestGateway } from "./test-gateway";

const globalForPayments = globalThis as unknown as { horayaGateway?: PaymentDeps["payments"] };

/** Stripe si les clés sont là, sinon la passerelle de test. */
export const paymentGateway: PaymentDeps["payments"] =
  globalForPayments.horayaGateway ??
  (env.STRIPE_SECRET_KEY
    ? createStripeGateway(env.STRIPE_SECRET_KEY)
    : createTestGateway(env.BETTER_AUTH_URL));
if (process.env.NODE_ENV !== "production") globalForPayments.horayaGateway = paymentGateway;

export const paymentDeps: PaymentDeps = { ...deps, payments: paymentGateway };
export const testPayments = paymentGateway.provider === "test";
