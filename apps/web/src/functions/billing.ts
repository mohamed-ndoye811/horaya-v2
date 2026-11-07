import { BILLING_INTERVALS } from "@horaya/core";
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { billingOverview, openBillingPortal, startCheckout } from "@/server/billing";

/** Écran « Abonnement » : formule en cours, origine, usage du mois. */
export const getBillingSettings = createServerFn({ method: "GET" }).handler(() =>
  billingOverview(),
);

/** « Passer à Pro / Équipe » : adresse du paiement Polar. */
export const checkoutPlan = createServerFn({ method: "POST" })
  .validator(z.object({ plan: z.enum(["pro", "equipe"]), interval: z.enum(BILLING_INTERVALS) }))
  .handler(({ data }) => startCheckout(data.plan, data.interval));

/** « Gérer mon abonnement » : adresse du portail client Polar. */
export const billingPortal = createServerFn({ method: "POST" }).handler(() => openBillingPortal());
