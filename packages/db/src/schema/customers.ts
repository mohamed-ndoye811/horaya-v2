import { sql } from "drizzle-orm";
import { boolean, index, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { createdAt, id, organizationId, updatedAt } from "./_columns";
import { member } from "./auth";

export const customer = pgTable(
  "customer",
  {
    id: id(),
    organizationId: organizationId(),
    firstName: text().notNull(),
    lastName: text().notNull(),
    email: text().notNull(),
    phone: text(),
    company: text(),
    tags: text().array().notNull().default(sql`'{}'::text[]`),
    marketingConsent: boolean().notNull().default(false),
    /** Suppression RGPD : les données personnelles sont effacées, l'historique reste. */
    anonymizedAt: timestamp({ withTimezone: true }),
    archivedAt: timestamp({ withTimezone: true }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    // Un e-mail = un client par organisateur, insensible à la casse.
    uniqueIndex("customer_org_email_unique").on(t.organizationId, sql`lower(${t.email})`),
    index().on(t.organizationId, t.lastName),
  ],
);

export const customerNote = pgTable(
  "customer_note",
  {
    id: id(),
    organizationId: organizationId(),
    customerId: uuid()
      .notNull()
      .references(() => customer.id, { onDelete: "cascade" }),
    authorMemberId: uuid().references(() => member.id, { onDelete: "set null" }),
    body: text().notNull(),
    pinned: boolean().notNull().default(false),
    createdAt: createdAt(),
  },
  (t) => [index().on(t.customerId, t.createdAt)],
);
