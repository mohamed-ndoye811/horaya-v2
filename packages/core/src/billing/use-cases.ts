import { type Actor, actorRef, assertMemberCan } from "../shared/actor";
import { ForbiddenError, ValidationError } from "../shared/errors";
import { fromZonedParts, toZonedParts } from "../shared/time";
import type { Deps, Repositories } from "../shared/unit-of-work";
import type { BillingAccount, BookingUsage, CurrentPlan, PlanGrant, Subscription } from "./model";
import {
  type BillingInterval,
  type BillingRate,
  PLANS,
  type PlanFeature,
  type PlanGrantKind,
  type PlanId,
  TRIAL_DAYS,
} from "./plans";
import { assertInventoryRoom, assertMemberRoom, bookingUsage, currentPlanOf } from "./rules";

const DAY = 24 * 60 * 60 * 1000;

/** Formule en cours d'un espace, dans une transaction déjà ouverte. */
export async function planOf(
  repositories: Repositories,
  organizationId: string,
  now: Date,
): Promise<CurrentPlan> {
  const [account, grants] = await Promise.all([
    repositories.billing.get(organizationId),
    repositories.billing.listGrants(organizationId),
  ]);
  return currentPlanOf(account, grants, now);
}

/** Bloque l'ajout de `adding` exemplaires au-delà de la formule (à appeler dans la transaction). */
export async function requireInventoryRoom(
  repositories: Repositories,
  organizationId: string,
  adding: number,
  now: Date,
): Promise<void> {
  const [{ plan }, used] = await Promise.all([
    planOf(repositories, organizationId, now),
    repositories.billing.countInventoryUnits(organizationId),
  ]);
  assertInventoryRoom(plan, used, adding);
}

/** Formule en cours, sans acteur : page publique (logo Horaya), menus de l'app. */
export function getCurrentPlan(deps: Deps, organizationId: string): Promise<CurrentPlan> {
  return deps.uow.run((repositories) => planOf(repositories, organizationId, deps.clock.now()));
}

/** Début du mois civil de `date` dans le fuseau de l'espace, et du mois précédent. */
function monthStarts(
  date: Date,
  timeZone: string,
): { thisMonth: Date; lastMonth: Date; nextMonth: Date } {
  const { year, month } = toZonedParts(date, timeZone);
  const start = (y: number, m: number) =>
    fromZonedParts({ year: y, month: m, day: 1, hour: 0, minute: 0 }, timeZone);
  return {
    thisMonth: start(year, month),
    lastMonth: month === 1 ? start(year - 1, 12) : start(year, month - 1),
    nextMonth: month === 12 ? start(year + 1, 1) : start(year, month + 1),
  };
}

export interface BillingOverview {
  current: CurrentPlan;
  account: BillingAccount;
  grants: PlanGrant[];
  seats: { used: number; limit: number | null };
  bookings: BookingUsage;
  /** Le membre peut-il payer, changer ou résilier (propriétaire) ? */
  canManage: boolean;
}

/** Facturation complète d'un espace, dans une transaction déjà ouverte. */
async function overviewOf(
  repositories: Repositories,
  organizationId: string,
  now: Date,
): Promise<Omit<BillingOverview, "canManage">> {
  const [account, grants, settings, seats] = await Promise.all([
    repositories.billing.get(organizationId),
    repositories.billing.listGrants(organizationId),
    repositories.settings.get(organizationId),
    repositories.billing.countSeats(organizationId),
  ]);
  const current = currentPlanOf(account, grants, now);
  const { thisMonth, lastMonth, nextMonth } = monthStarts(now, settings.timezone);
  const [usedThisMonth, usedLastMonth] = await Promise.all([
    repositories.billing.countBookings(organizationId, thisMonth, nextMonth),
    repositories.billing.countBookings(organizationId, lastMonth, thisMonth),
  ]);
  return {
    current,
    account,
    grants,
    seats: { used: seats, limit: PLANS[current.plan].limits.members },
    bookings: bookingUsage(current.plan, usedThisMonth, usedLastMonth),
  };
}

/** Page « Abonnement » : formule, origine, usage du mois. Tout membre la consulte. */
export async function getBillingOverview(deps: Deps, actor: Actor): Promise<BillingOverview> {
  if (actor.type !== "member") throw new ForbiddenError();
  const now = deps.clock.now();
  return deps.uow.run(async (repositories) => ({
    ...(await overviewOf(repositories, actor.organizationId, now)),
    canManage: actor.role === "owner",
  }));
}

/** Cockpit de la plateforme : la facturation d'un espace, vue par l'équipe Horaya. */
export async function getWorkspaceBilling(
  deps: Deps,
  organizationId: string,
): Promise<Omit<BillingOverview, "canManage">> {
  return deps.uow.run((repositories) => overviewOf(repositories, organizationId, deps.clock.now()));
}

/**
 * Avant une invitation ou l'arrivée par lien : reste-t-il une place dans la formule ? Les
 * droits (qui invite) sont vérifiés par Better Auth et par l'appelant.
 */
export async function assertSeatAvailable(deps: Deps, organizationId: string): Promise<void> {
  await deps.uow.run(async (repositories) => {
    const [current, seats] = await Promise.all([
      planOf(repositories, organizationId, deps.clock.now()),
      repositories.billing.countSeats(organizationId),
    ]);
    assertMemberRoom(current.plan, seats);
  });
}

/** Ce qu'il faut pour ouvrir un paiement chez Polar (propriétaire seulement). */
export async function prepareCheckout(
  deps: Deps,
  actor: Actor,
  plan: PlanId,
  interval: BillingInterval,
): Promise<{ organizationId: string; plan: PlanId; interval: BillingInterval; rate: BillingRate }> {
  assertMemberCan(actor, "billing", "manage");
  if (plan === "libre") throw new ValidationError("La formule Libre est gratuite");
  const account = await deps.uow.run((repositories) =>
    repositories.billing.get(actor.organizationId),
  );
  return { organizationId: actor.organizationId, plan, interval, rate: account.rate };
}

/** Client Polar de l'espace, pour ouvrir son portail (factures, carte, résiliation). */
export async function billingCustomer(deps: Deps, actor: Actor): Promise<string | null> {
  assertMemberCan(actor, "billing", "manage");
  const account = await deps.uow.run((repositories) =>
    repositories.billing.get(actor.organizationId),
  );
  return account.subscription?.polarCustomerId ?? null;
}

/** Webhook Polar : l'abonnement de l'espace a changé (création, paiement, résiliation…). */
export async function applySubscription(
  deps: Deps,
  organizationId: string,
  subscription: Subscription,
): Promise<void> {
  const actor: Actor = { type: "system", organizationId };
  await deps.uow.run(async (repositories) => {
    await repositories.billing.saveSubscription(organizationId, subscription);
    await repositories.activity.record({
      organizationId,
      entityType: "billing",
      entityId: organizationId,
      action: "billing.subscription_updated",
      ...actorRef(actor),
      data: {
        plan: subscription.plan,
        interval: subscription.interval,
        status: subscription.status,
      },
    });
  });
}

/**
 * Webhook Polar : l'abonnement de l'espace est passé sur un produit qui n'est pas une formule
 * Horaya (changement de formule depuis le portail). La formule s'arrête tout de suite ;
 * un autre abonnement que celui de l'espace ne change rien.
 */
export async function endSubscription(
  deps: Deps,
  organizationId: string,
  polarSubscriptionId: string,
): Promise<boolean> {
  const actor: Actor = { type: "system", organizationId };
  return deps.uow.run(async (repositories) => {
    const { subscription } = await repositories.billing.get(organizationId);
    if (subscription?.polarSubscriptionId !== polarSubscriptionId) return false;
    await repositories.billing.saveSubscription(organizationId, {
      ...subscription,
      status: "canceled",
      currentPeriodEnd: deps.clock.now(),
      cancelAtPeriodEnd: false,
    });
    await repositories.activity.record({
      organizationId,
      entityType: "billing",
      entityId: organizationId,
      action: "billing.subscription_updated",
      ...actorRef(actor),
      data: { plan: subscription.plan, interval: subscription.interval, status: "canceled" },
    });
    return true;
  });
}

/** Espace dont le client Polar est celui-ci (webhooks sans métadonnée). */
export function organizationOfPolarCustomer(
  deps: Deps,
  polarCustomerId: string,
): Promise<string | null> {
  return deps.uow.run((repositories) => repositories.billing.findByPolarCustomer(polarCustomerId));
}

/** Essai de Pro à la création de l'espace, une seule fois. */
export async function startTrial(deps: Deps, organizationId: string): Promise<void> {
  const now = deps.clock.now();
  await deps.uow.run(async (repositories) => {
    const grants = await repositories.billing.listGrants(organizationId);
    if (grants.some((grant) => grant.kind === "trial")) return;
    await repositories.billing.addGrant({
      organizationId,
      kind: "trial",
      plan: "pro",
      reason: null,
      expiresAt: new Date(now.getTime() + TRIAL_DAYS * DAY),
    });
  });
}

/**
 * Licence offerte par la plateforme (bêta-testeur, geste) : réservé à l'équipe Horaya
 * (cockpit, scripts), d'où l'absence d'acteur membre.
 */
export async function grantPlan(
  deps: Deps,
  organizationId: string,
  input: {
    kind: Exclude<PlanGrantKind, "trial">;
    plan: PlanId;
    days: number | null;
    reason: string | null;
  },
  /** Membre de l'équipe Horaya qui agit (e-mail), pour le journal. */
  by: string | null = null,
): Promise<PlanGrant> {
  if (input.plan === "libre")
    throw new ValidationError("La formule Libre n'a pas besoin de licence");
  const now = deps.clock.now();
  return deps.uow.run(async (repositories) => {
    const grant = await repositories.billing.addGrant({
      organizationId,
      kind: input.kind,
      plan: input.plan,
      reason: input.reason,
      expiresAt: input.days === null ? null : new Date(now.getTime() + input.days * DAY),
    });
    await repositories.activity.record({
      organizationId,
      entityType: "billing",
      entityId: grant.id,
      action: "billing.plan_granted",
      actorType: "system",
      actorId: null,
      data: { kind: grant.kind, plan: grant.plan, by },
    });
    return grant;
  });
}

export async function revokePlanGrant(
  deps: Deps,
  organizationId: string,
  grantId: string,
  by: string | null = null,
): Promise<boolean> {
  return deps.uow.run(async (repositories) => {
    const revoked = await repositories.billing.revokeGrant(
      organizationId,
      grantId,
      deps.clock.now(),
    );
    if (revoked) {
      await repositories.activity.record({
        organizationId,
        entityType: "billing",
        entityId: grantId,
        action: "billing.plan_revoked",
        actorType: "system",
        actorId: null,
        data: { by },
      });
    }
    return revoked;
  });
}

/** Tarif solidaire ou bêta : appliqué au prochain paiement chez Polar. */
export async function setBillingRate(
  deps: Deps,
  organizationId: string,
  rate: BillingRate,
  by: string | null = null,
): Promise<void> {
  await deps.uow.run(async (repositories) => {
    await repositories.billing.setRate(organizationId, rate);
    await repositories.activity.record({
      organizationId,
      entityType: "billing",
      entityId: organizationId,
      action: "billing.rate_updated",
      actorType: "system",
      actorId: null,
      data: { rate, by },
    });
  });
}
