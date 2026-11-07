import {
  applySubscription,
  type BillingInterval,
  type BillingRate,
  billingCustomer,
  getBillingOverview,
  type PlanId,
  prepareCheckout,
  type SubscriptionStatus,
} from "@horaya/core";
import { createPolar } from "@polar-sh/sdk/2026-10";
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

export async function billingOverview() {
  const { actor, timeZone } = await getWorkspaceContext();
  const overview = await getBillingOverview(deps, actor);
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
