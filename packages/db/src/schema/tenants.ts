import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";
import { createdAt, currency, id, organizationId, updatedAt } from "./_columns";
import { member, organization } from "./auth";
import { actorType, stripeAccountStatus } from "./enums";

/**
 * Réglages métier d'un organisateur (1:1 avec `organization` de Better Auth,
 * qu'on garde intacte pour faciliter ses mises à jour).
 */
export const tenantSettings = pgTable("tenant_settings", {
  organizationId: uuid()
    .primaryKey()
    .references(() => organization.id, { onDelete: "cascade" }),
  brandColor: text().notNull().default("#264489"),
  description: text(),
  address: text(),
  timezone: text().notNull().default("Europe/Paris"),
  locale: text().notNull().default("fr"),
  currency: currency(),
  /** TVA en points de base : 2000 = 20 %. */
  vatRateBps: integer().notNull().default(2000),
  defaultDepositPercent: integer().notNull().default(30),
  /** Annulation gratuite jusqu'à N heures avant le début. */
  freeCancellationHours: integer().notNull().default(72),
  /** Part remboursée en cas d'annulation tardive. */
  lateCancellationRefundPercent: integer().notNull().default(50),
  bookingReferencePrefix: text().notNull().default("HRY"),
  stripeAccountId: text(),
  stripeAccountStatus: stripeAccountStatus().notNull().default("not_connected"),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

/** Compteurs par tenant pour les références lisibles (ex. HRY-2606-0388). */
export const referenceCounter = pgTable(
  "reference_counter",
  {
    organizationId: organizationId(),
    scope: text().notNull(),
    period: text().notNull(),
    value: integer().notNull().default(0),
  },
  (t) => [primaryKey({ columns: [t.organizationId, t.scope, t.period] })],
);

export const notificationPreference = pgTable(
  "notification_preference",
  {
    id: id(),
    organizationId: organizationId(),
    memberId: uuid()
      .notNull()
      .references(() => member.id, { onDelete: "cascade" }),
    notificationType: text().notNull(),
    email: boolean().notNull().default(true),
    inApp: boolean().notNull().default(true),
  },
  (t) => [unique().on(t.memberId, t.notificationType)],
);

export const notification = pgTable(
  "notification",
  {
    id: id(),
    organizationId: organizationId(),
    memberId: uuid()
      .notNull()
      .references(() => member.id, { onDelete: "cascade" }),
    type: text().notNull(),
    title: text().notNull(),
    body: text(),
    link: text(),
    payload: jsonb().$type<Record<string, unknown>>(),
    readAt: timestamp({ withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [index().on(t.memberId, t.readAt)],
);

/** Journal générique : timeline des réservations, audit des actions. */
export const activityLog = pgTable(
  "activity_log",
  {
    id: id(),
    organizationId: organizationId(),
    entityType: text().notNull(),
    entityId: uuid().notNull(),
    action: text().notNull(),
    actorType: actorType().notNull(),
    actorId: uuid(),
    data: jsonb().$type<Record<string, unknown>>(),
    createdAt: createdAt(),
  },
  (t) => [
    index("activity_log_entity_idx").on(t.organizationId, t.entityType, t.entityId, t.createdAt),
  ],
);
