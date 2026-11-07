import { boolean, index, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { createdAt, id, organizationId, updatedAt } from "./_columns";
import { organization } from "./auth";
import { billingInterval, billingRate, planGrantKind, planId, subscriptionStatus } from "./enums";

/**
 * Facturation d'un espace (lot 24) : son tarif (standard, solidaire, bêta) et son abonnement
 * Polar, une ligne par espace, créée au premier besoin. Sans abonnement, colonnes à null.
 */
export const billing = pgTable("billing", {
  organizationId: uuid()
    .primaryKey()
    .references(() => organization.id, { onDelete: "cascade" }),
  rate: billingRate().notNull().default("standard"),
  plan: planId(),
  interval: billingInterval(),
  status: subscriptionStatus(),
  polarCustomerId: text().unique(),
  polarSubscriptionId: text(),
  currentPeriodEnd: timestamp({ withTimezone: true }),
  cancelAtPeriodEnd: boolean().notNull().default(false),
  updatedAt: updatedAt(),
});

/** Licences : formule offerte (essai, bêta-testeur, geste), retirée en posant `revokedAt`. */
export const planGrant = pgTable(
  "plan_grant",
  {
    id: id(),
    organizationId: organizationId(),
    kind: planGrantKind().notNull(),
    plan: planId().notNull(),
    reason: text(),
    expiresAt: timestamp({ withTimezone: true }),
    revokedAt: timestamp({ withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [index().on(t.organizationId)],
);
