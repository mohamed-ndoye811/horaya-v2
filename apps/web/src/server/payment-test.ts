/**
 * Passerelle de paiement de test (PAYMENTS_TEST_GATEWAY=1, en local) : remplace la page de
 * paiement et l'activation du compte Stripe tant que les clés ne sont pas configurées.
 */
import { completeCheckout, expireCheckout } from "@horaya/core";
import { getCheckoutSummary } from "@horaya/db";
import { notFound, redirect } from "@tanstack/react-router";
import { db } from "./db";
import { env } from "./env";
import { paymentDeps, testPayments } from "./payments";

/** Seuls les retours vers l'app sont suivis (pas de redirection ouverte). */
function safe(url: string): string {
  const base = new URL(env.BETTER_AUTH_URL);
  const target = new URL(url, base);
  return target.origin === base.origin ? target.toString() : "/";
}

function testDeps() {
  const deps = paymentDeps;
  if (!testPayments || !deps) throw notFound();
  return deps;
}

/** Page de paiement de test d'une session (checkout). */
export async function testCheckout(checkout: string) {
  testDeps();
  const summary = await getCheckoutSummary(db, "test", checkout);
  if (!summary) throw notFound();
  return summary;
}

/** Activation de test : l'adresse de retour, ramenée dans l'app. */
export function testOnboarding(back: string | undefined) {
  testDeps();
  const target = new URL(back ?? "/app/parametres/paiements", env.BETTER_AUTH_URL);
  return target.origin === new URL(env.BETTER_AUTH_URL).origin ? target.toString() : "/app";
}

export async function simulatePayment(checkoutId: string, successUrl: string): Promise<never> {
  await completeCheckout(
    testDeps(),
    "test",
    checkoutId,
    `pi_test_${crypto.randomUUID().slice(0, 12)}`,
  );
  throw redirect({ href: safe(successUrl) });
}

export async function simulateExpiry(checkoutId: string, cancelUrl: string): Promise<never> {
  await expireCheckout(testDeps(), "test", checkoutId);
  throw redirect({ href: safe(cancelUrl) });
}

export function leaveCheckout(cancelUrl: string): never {
  throw redirect({ href: safe(cancelUrl) });
}
