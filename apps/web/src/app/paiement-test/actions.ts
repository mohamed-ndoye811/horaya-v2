"use server";

import { completeCheckout, expireCheckout } from "@horaya/core";
import { notFound, redirect } from "next/navigation";
import { paymentDeps, testPayments } from "@/server/payments";

/** Seuls les retours vers l'app sont suivis (pas de redirection ouverte). */
function safe(url: string): string {
  const base = new URL(process.env.BETTER_AUTH_URL ?? "http://localhost:3000");
  const target = new URL(url, base);
  return target.origin === base.origin ? target.toString() : "/";
}

export async function simulatePaymentAction(checkoutId: string, successUrl: string) {
  if (!testPayments) notFound();
  await completeCheckout(
    paymentDeps,
    "test",
    checkoutId,
    `pi_test_${crypto.randomUUID().slice(0, 12)}`,
  );
  redirect(safe(successUrl));
}

export async function simulateExpiryAction(checkoutId: string, cancelUrl: string) {
  if (!testPayments) notFound();
  await expireCheckout(paymentDeps, "test", checkoutId);
  redirect(safe(cancelUrl));
}

export async function leaveCheckoutAction(cancelUrl: string) {
  redirect(safe(cancelUrl));
}
