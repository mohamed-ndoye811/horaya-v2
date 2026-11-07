import type {
  BillingInterval,
  BillingRate,
  PlanGrantKind,
  PlanId,
  SubscriptionStatus,
} from "./plans";

/** Abonnement payant de l'espace chez Polar (un seul à la fois). */
export interface Subscription {
  plan: PlanId;
  interval: BillingInterval;
  status: SubscriptionStatus;
  polarCustomerId: string;
  polarSubscriptionId: string;
  currentPeriodEnd: Date | null;
  cancelAtPeriodEnd: boolean;
}

/** Compte de facturation d'un espace : son tarif et son éventuel abonnement. */
export interface BillingAccount {
  organizationId: string;
  rate: BillingRate;
  subscription: Subscription | null;
}

/** Licence : formule offerte, jusqu'à `expiresAt` (ou sans fin), tant qu'elle n'est pas retirée. */
export interface PlanGrant {
  id: string;
  organizationId: string;
  kind: PlanGrantKind;
  plan: PlanId;
  reason: string | null;
  expiresAt: Date | null;
  revokedAt: Date | null;
  createdAt: Date;
}

/** D'où vient la formule en cours. */
export type PlanSource = "free" | "subscription" | PlanGrantKind;

export interface CurrentPlan {
  plan: PlanId;
  source: PlanSource;
  /** Fin connue (essai, licence limitée, abonnement résilié) ; `null` sinon. */
  until: Date | null;
}

export interface BookingUsage {
  limit: number | null;
  thisMonth: number;
  lastMonth: number;
  /** Ce mois-ci au-delà du quota : l'organisateur est prévenu, rien n'est bloqué. */
  over: boolean;
  /** Deux mois de suite au-delà : on lui propose alors la formule supérieure. */
  suggestUpgrade: boolean;
}
