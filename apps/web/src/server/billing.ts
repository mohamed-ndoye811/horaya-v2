import {
  type Actor,
  applySubscription,
  type BillingInterval,
  type BillingRate,
  billingCustomer,
  bookingUsage,
  getBillingOverview,
  grantPlan,
  type PlanId,
  prepareCheckout,
  type SubscriptionStatus,
  setBillingRate,
  startTrial,
} from "@horaya/core";
import { resetBilling } from "@horaya/db";
import { createPolar } from "@polar-sh/sdk/2026-10";
import type { PlanPreview } from "@/lib/plan-preview";
import { db } from "./db";
import { env } from "./env";
import { deps } from "./services";
import { getWorkspaceContext } from "./workspace";

/*
 * Abonnements d'Horaya chez Polar (vendeur officiel : TVA et factures à sa charge). Le core
 * décide (formules, droits, licences) ; ici, seulement les appels à Polar et leur traduction.
 */

const polar = env.POLAR_ACCESS_TOKEN
  ? createPolar({ accessToken: env.POLAR_ACCESS_TOKEN, environment: env.POLAR_SERVER })
  : null;

type PaidPlan = Exclude<PlanId, "libre">;

const PRODUCTS: Record<PaidPlan, Record<BillingInterval, string | undefined>> = {
  pro: { month: env.POLAR_PRODUCT_PRO_MONTH, year: env.POLAR_PRODUCT_PRO_YEAR },
  equipe: { month: env.POLAR_PRODUCT_EQUIPE_MONTH, year: env.POLAR_PRODUCT_EQUIPE_YEAR },
};

const DISCOUNTS: Record<BillingRate, string | undefined> = {
  standard: undefined,
  solidaire: env.POLAR_DISCOUNT_SOLIDAIRE,
  beta: env.POLAR_DISCOUNT_BETA,
};

/** En local sans Polar (poste de travail) : le paiement est simulé pour tester les écrans. */
const simulated = !polar && Boolean(env.POSTE);

/** Le paiement en ligne est-il possible sur ce serveur ? */
export const billingAvailable = simulated || Boolean(polar);

/** Formule et période d'un produit Polar (webhooks). */
export function planOfProduct(
  productId: string,
): { plan: PaidPlan; interval: BillingInterval } | null {
  for (const plan of ["pro", "equipe"] as const) {
    for (const interval of ["month", "year"] as const) {
      if (PRODUCTS[plan][interval] === productId) return { plan, interval };
    }
  }
  return null;
}

/** Statut Polar → statut Horaya : l'impayé garde l'accès le temps des relances. */
export function subscriptionStatusOf(status: string): SubscriptionStatus {
  if (status === "active" || status === "trialing") return "active";
  if (status === "past_due" || status === "unpaid" || status === "incomplete") return "past_due";
  return "canceled";
}

/**
 * Quota simulé par « Voir en tant que » (postes de développement) : réservations de ce mois
 * et du précédent. shortcut: gardé en mémoire du serveur, perdu au redémarrage (suffit en local).
 */
let quotaPreview: { thisMonth: number; lastMonth: number } | null = null;

/** Vue d'ensemble du core, avec le quota simulé en développement. */
export async function billingFor(actor: Actor) {
  const overview = await getBillingOverview(deps, actor);
  if (!env.POSTE || !quotaPreview) return overview;
  return {
    ...overview,
    bookings: bookingUsage(overview.current.plan, quotaPreview.thisMonth, quotaPreview.lastMonth),
  };
}

export async function billingOverview() {
  const { actor, timeZone } = await getWorkspaceContext();
  const overview = await billingFor(actor);
  const day = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "long", timeZone });
  const subscription = overview.account.subscription;
  return {
    plan: overview.current.plan,
    source: overview.current.source,
    until: overview.current.until && day.format(overview.current.until),
    rate: overview.account.rate,
    subscription: subscription && {
      interval: subscription.interval,
      status: subscription.status,
      cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
      renewsOn: subscription.currentPeriodEnd && day.format(subscription.currentPeriodEnd),
    },
    seats: overview.seats,
    bookings: overview.bookings,
    canManage: overview.canManage,
    available: billingAvailable,
    /** Poste de développement : le sélecteur « Voir en tant que » s'affiche. */
    preview: Boolean(env.POSTE),
  };
}

/** Ouvre le paiement Polar ; renvoie l'adresse où envoyer le navigateur. */
export async function startCheckout(plan: PaidPlan, interval: BillingInterval): Promise<string> {
  const { actor, user } = await getWorkspaceContext();
  const order = await prepareCheckout(deps, actor, plan, interval);
  const back = new URL("/app/parametres/abonnement", env.BETTER_AUTH_URL);

  if (simulated) {
    await applySubscription(deps, order.organizationId, {
      plan,
      interval,
      status: "active",
      polarCustomerId: `test_cus_${order.organizationId}`,
      polarSubscriptionId: `test_sub_${order.organizationId}`,
      currentPeriodEnd: new Date(Date.now() + (interval === "year" ? 365 : 30) * 864e5),
      cancelAtPeriodEnd: false,
    });
    back.searchParams.set("paiement", "ok");
    return back.toString();
  }
  const product = PRODUCTS[plan][interval];
  if (!polar || !product) throw new Error("Paiement en ligne non configuré");
  back.searchParams.set("paiement", "ok");
  const checkout = await polar.checkouts.create({
    products: [product],
    customer_email: user.email,
    external_customer_id: order.organizationId,
    metadata: { organization_id: order.organizationId },
    discount_id: DISCOUNTS[order.rate] ?? null,
    success_url: back.toString(),
    locale: "fr",
  });
  return checkout.url;
}

/** Portail client Polar (factures, carte, changement de formule, résiliation en un clic). */
export async function openBillingPortal(): Promise<string> {
  const { actor } = await getWorkspaceContext();
  const customerId = await billingCustomer(deps, actor);
  const back = new URL("/app/parametres/abonnement", env.BETTER_AUTH_URL).toString();
  if (!customerId || !polar) return back;
  const session = await polar.customerSessions.create({
    customer_id: customerId,
    return_url: back,
  });
  return session.customer_portal_url;
}

/**
 * « Voir en tant que » : remet l'espace dans une situation de facturation donnée, pour de vrai
 * dans la base locale (les limites du core suivent). Jamais hors d'un poste de développement.
 */
export async function previewPlan(choice: PlanPreview): Promise<void> {
  if (!env.POSTE) throw new Error("Réservé aux postes de développement");
  const { workspace } = await getWorkspaceContext();
  const id = workspace.id;
  const inDays = (days: number) => new Date(Date.now() + days * 864e5);
  const subscribe = (
    plan: PaidPlan,
    interval: BillingInterval,
    status: SubscriptionStatus,
    cancelAtPeriodEnd = false,
  ) =>
    applySubscription(deps, id, {
      plan,
      interval,
      status,
      polarCustomerId: `test_cus_${id}`,
      polarSubscriptionId: `test_sub_${id}`,
      currentPeriodEnd: inDays(cancelAtPeriodEnd ? 10 : interval === "year" ? 365 : 30),
      cancelAtPeriodEnd,
    });

  await resetBilling(db, id);
  quotaPreview = null;
  switch (choice) {
    case "libre":
      return;
    case "quota":
      quotaPreview = { thisMonth: 64, lastMonth: 31 };
      return;
    case "quota2":
      quotaPreview = { thisMonth: 64, lastMonth: 58 };
      return;
    case "essai":
      return startTrial(deps, id);
    case "bt":
      await setBillingRate(deps, id, "beta");
      await grantPlan(deps, id, { kind: "beta", plan: "pro", days: null, reason: "Aperçu" });
      return;
    case "solidaire":
      await setBillingRate(deps, id, "solidaire");
      return subscribe("pro", "month", "active");
    case "pro":
      return subscribe("pro", "month", "active");
    case "equipe":
      return subscribe("equipe", "year", "active");
    case "impaye":
      return subscribe("pro", "month", "past_due");
    case "resilie":
      return subscribe("pro", "month", "active", true);
  }
}
