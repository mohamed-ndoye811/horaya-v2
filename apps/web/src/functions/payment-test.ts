import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import {
  leaveCheckout,
  simulateExpiry,
  simulatePayment,
  testCheckout,
  testOnboarding,
} from "@/server/payment-test";

/** Passerelle de paiement de test : pages et boutons (chaque action redirige). */
const checkoutId = z.string().max(200);
const url = z.string().max(2000);

export const getTestCheckout = createServerFn({ method: "GET" })
  .validator(checkoutId)
  .handler(({ data }) => testCheckout(data));

export const getTestOnboarding = createServerFn({ method: "GET" })
  .validator(z.string().max(2000).optional())
  .handler(({ data }) => ({ back: testOnboarding(data) }));

const payFn = createServerFn({ method: "POST" })
  .validator(z.object({ checkoutId, url }))
  .handler(({ data }) => simulatePayment(data.checkoutId, data.url));
const expireFn = createServerFn({ method: "POST" })
  .validator(z.object({ checkoutId, url }))
  .handler(({ data }) => simulateExpiry(data.checkoutId, data.url));
const leaveFn = createServerFn({ method: "POST" })
  .validator(url)
  .handler(({ data }) => leaveCheckout(data));

export const simulatePaymentAction = (checkoutId: string, successUrl: string) =>
  payFn({ data: { checkoutId, url: successUrl } });
export const simulateExpiryAction = (checkoutId: string, cancelUrl: string) =>
  expireFn({ data: { checkoutId, url: cancelUrl } });
export const leaveCheckoutAction = (cancelUrl: string) => leaveFn({ data: cancelUrl });
