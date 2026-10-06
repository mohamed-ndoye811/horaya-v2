export const MEMBER_ROLES = ["owner", "admin", "editor", "viewer"] as const;
export type MemberRole = (typeof MEMBER_ROLES)[number];

export const STRIPE_ACCOUNT_STATUSES = [
  "not_connected",
  "pending",
  "active",
  "restricted",
] as const;
export type StripeAccountStatus = (typeof STRIPE_ACCOUNT_STATUSES)[number];

/** Qui est à l'origine d'une action dans le journal d'activité. */
export const ACTOR_TYPES = ["member", "customer", "system"] as const;
export type ActorType = (typeof ACTOR_TYPES)[number];
