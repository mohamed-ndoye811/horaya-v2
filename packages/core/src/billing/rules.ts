import { ConflictError } from "../shared/errors";
import type { BillingAccount, BookingUsage, CurrentPlan, PlanGrant } from "./model";
import { PLAN_RANK, PLANS, type PlanFeature, type PlanId } from "./plans";

/** Limite de la formule atteinte : on bloque la création, jamais ce qui existe déjà. */
export class PlanLimitError extends ConflictError {
  override readonly code = "plan_limit";
}

/** Un abonnement résilié donne accès jusqu'à la fin de la période payée ; un impayé aussi (Polar relance). */
function subscriptionPlan(account: BillingAccount, now: Date): CurrentPlan | null {
  const subscription = account.subscription;
  if (!subscription) return null;
  if (subscription.status === "canceled") {
    const end = subscription.currentPeriodEnd;
    return end && end > now
      ? { plan: subscription.plan, source: "subscription", until: end }
      : null;
  }
  return {
    plan: subscription.plan,
    source: "subscription",
    until: subscription.cancelAtPeriodEnd ? subscription.currentPeriodEnd : null,
  };
}

/** Formule en cours : la plus haute entre l'abonnement et les licences valides, sinon Libre. */
export function currentPlanOf(
  account: BillingAccount,
  grants: readonly PlanGrant[],
  now: Date,
): CurrentPlan {
  let best: CurrentPlan = { plan: "libre", source: "free", until: null };
  const candidates: CurrentPlan[] = grants
    .filter((grant) => !grant.revokedAt && (!grant.expiresAt || grant.expiresAt > now))
    .map((grant) => ({ plan: grant.plan, source: grant.kind, until: grant.expiresAt }));
  // L'abonnement passe en premier : à formule égale, c'est lui qu'on affiche.
  const paid = subscriptionPlan(account, now);
  if (paid) candidates.unshift(paid);
  for (const candidate of candidates) {
    if (PLAN_RANK[candidate.plan] > PLAN_RANK[best.plan]) best = candidate;
  }
  return best;
}

export function hasFeature(plan: PlanId, feature: PlanFeature): boolean {
  return PLANS[plan].features.includes(feature);
}

/** `count` membres et invitations en attente : peut-on en inviter un de plus ? */
export function assertMemberRoom(plan: PlanId, count: number): void {
  const limit = PLANS[plan].limits.members;
  if (limit === null || count < limit) return;
  throw new PlanLimitError(
    limit === 1
      ? `La formule ${PLANS[plan].name} est faite pour travailler seul. Passe à Pro pour inviter ton équipe.`
      : `La formule ${PLANS[plan].name} compte ${limit} membres au plus. Passe à la formule supérieure pour en ajouter.`,
  );
}

/** `used` exemplaires de matériel (hors retirés) : peut-on en ajouter `adding` ? */
export function assertInventoryRoom(plan: PlanId, used: number, adding: number): void {
  const limit = PLANS[plan].limits.inventoryUnits;
  if (limit === null || used + adding <= limit) return;
  throw new PlanLimitError(
    `La formule ${PLANS[plan].name} compte ${limit} exemplaires de matériel au plus (tu en as ${used}). Passe à Pro dans Réglages > Abonnement pour en ajouter.`,
  );
}

export function bookingUsage(plan: PlanId, thisMonth: number, lastMonth: number): BookingUsage {
  const limit = PLANS[plan].limits.bookingsPerMonth;
  const over = limit !== null && thisMonth > limit;
  return {
    limit,
    thisMonth,
    lastMonth,
    over,
    suggestUpgrade: over && limit !== null && lastMonth > limit,
  };
}
