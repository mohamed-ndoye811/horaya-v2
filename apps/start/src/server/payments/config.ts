import { env } from "../env";

/**
 * Paiement en ligne intégré (Stripe Connect) : seulement avec des clés Stripe, ou la passerelle
 * de test activée exprès en local. Sinon, les organisateurs passent par un lien de paiement.
 */
export const stripeEnabled = Boolean(env.STRIPE_SECRET_KEY);
export const testGatewayEnabled = !stripeEnabled && env.PAYMENTS_TEST_GATEWAY === "1";
export const integratedPaymentsEnabled = stripeEnabled || testGatewayEnabled;
