import type { BookingRules, CustomFieldDefinition } from "@horaya/core";
import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";
import { cents, createdAt, currency, id, organizationId, updatedAt } from "./_columns";
import { eventStatus, eventVisibility, paymentMode } from "./enums";

export const eventType = pgTable(
  "event_type",
  {
    id: id(),
    organizationId: organizationId(),
    name: text().notNull(),
    color: text().notNull(),
    description: text(),
    defaultDurationMinutes: integer(),
    defaultPriceCents: cents(),
    defaultCapacity: integer(),
    requiresApproval: boolean().notNull().default(false),
    customFields: jsonb().$type<CustomFieldDefinition[]>().notNull().default([]),
    bookingRules: jsonb().$type<BookingRules>().notNull().default({}),
    archivedAt: timestamp({ withTimezone: true }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [unique().on(t.organizationId, t.name)],
);

/** Série récurrente : la règle vit ici, chaque occurrence est un vrai `event`. */
export const eventSeries = pgTable("event_series", {
  id: id(),
  organizationId: organizationId(),
  /** Règle iCalendar, ex. FREQ=MONTHLY;INTERVAL=2 */
  rrule: text().notNull(),
  until: timestamp({ withTimezone: true }),
  timezone: text().notNull(),
  createdAt: createdAt(),
});

export const event = pgTable(
  "event",
  {
    id: id(),
    organizationId: organizationId(),
    eventTypeId: uuid()
      .notNull()
      .references(() => eventType.id, { onDelete: "restrict" }),
    seriesId: uuid().references(() => eventSeries.id, { onDelete: "set null" }),
    title: text().notNull(),
    slug: text().notNull(),
    description: text().notNull().default(""),
    status: eventStatus().notNull().default("draft"),
    visibility: eventVisibility().notNull().default("public"),
    startsAt: timestamp({ withTimezone: true }).notNull(),
    endsAt: timestamp({ withTimezone: true }).notNull(),
    timezone: text().notNull(),
    locationName: text(),
    locationAddress: text(),
    onlineUrl: text(),
    /** null = places illimitées. */
    capacity: integer(),
    priceCents: cents().notNull().default(0),
    currency: currency(),
    paymentMode: paymentMode().notNull().default("free"),
    depositPercent: integer(),
    requiresApproval: boolean().notNull().default(false),
    /** Mentions affichées sur la page publique (« Déjeuner inclus »…). */
    highlights: text().array().notNull().default(sql`'{}'::text[]`),
    coverImageUrl: text(),
    publishedAt: timestamp({ withTimezone: true }),
    cancelledAt: timestamp({ withTimezone: true }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    unique().on(t.organizationId, t.slug),
    index().on(t.organizationId, t.startsAt),
    index().on(t.organizationId, t.status),
    index().on(t.seriesId),
    check("event_period_valid", sql`${t.endsAt} > ${t.startsAt}`),
    check("event_capacity_positive", sql`${t.capacity} IS NULL OR ${t.capacity} > 0`),
    check("event_price_positive", sql`${t.priceCents} >= 0`),
    check(
      "event_deposit_percent_range",
      sql`${t.depositPercent} IS NULL OR (${t.depositPercent} > 0 AND ${t.depositPercent} <= 100)`,
    ),
  ],
);

export const eventMedia = pgTable(
  "event_media",
  {
    id: id(),
    eventId: uuid()
      .notNull()
      .references(() => event.id, { onDelete: "cascade" }),
    url: text().notNull(),
    alt: text(),
    position: integer().notNull().default(0),
    createdAt: createdAt(),
  },
  (t) => [index().on(t.eventId, t.position)],
);
