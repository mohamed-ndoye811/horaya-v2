import type { RuleAction } from "@horaya/core";
import { boolean, index, jsonb, pgTable, text, unique, uuid } from "drizzle-orm/pg-core";
import { createdAt, id, organizationId } from "./_columns";
import { booking } from "./bookings";
import { event } from "./events";

/**
 * Trace des règles « si… alors… » (lot 36) : une ligne par règle exécutée sur une séance
 * (moment planifié, `booking_id` vide) ou sur une inscription. L'unicité garantit qu'une règle
 * ne tourne jamais deux fois au même endroit, même avec deux passages simultanés.
 */
export const ruleRun = pgTable(
  "rule_run",
  {
    id: id(),
    organizationId: organizationId(),
    eventId: uuid()
      .notNull()
      .references(() => event.id, { onDelete: "cascade" }),
    bookingId: uuid().references(() => booking.id, { onDelete: "cascade" }),
    /** Identifiant de la règle dans `event.rules`. */
    ruleId: text().notNull(),
    ruleName: text().notNull(),
    trigger: text().notNull(),
    /** Conditions remplies : les actions ont été appliquées. */
    matched: boolean().notNull(),
    actions: jsonb().$type<RuleAction[]>().notNull().default([]),
    createdAt: createdAt(),
  },
  (t) => [
    unique("rule_run_once").on(t.eventId, t.ruleId, t.bookingId).nullsNotDistinct(),
    index().on(t.bookingId),
  ],
);
