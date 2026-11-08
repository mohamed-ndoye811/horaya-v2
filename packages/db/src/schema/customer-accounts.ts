import { index, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { createdAt, id, updatedAt } from "./_columns";
import { organization } from "./auth";

/**
 * Espace client (lot 29) : une identité par e-mail vérifié, commune à tous les espaces, sans
 * mot de passe. Elle se relie aux fiches `customer` par l'adresse (lower(email)) : aucune
 * clé étrangère, chaque espace garde ses fiches, et le supprimer ne touche pas aux réservations.
 */
export const customerAccount = pgTable("customer_account", {
  id: id(),
  /** Toujours en minuscules. */
  email: text().notNull().unique(),
  firstName: text(),
  lastName: text(),
  phone: text(),
  /** Agenda personnel (/agenda/client/<jeton>.ics) : en clair, comme celui des membres. */
  calendarToken: text().notNull().unique(),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

/** Liens magiques de connexion : 15 minutes, une seule fois, jeton haché. */
export const customerLoginLink = pgTable(
  "customer_login_link",
  {
    tokenHash: text().primaryKey(),
    email: text().notNull(),
    /** Espace depuis lequel le lien a été demandé (null : vue horaya.app). */
    organizationId: uuid().references(() => organization.id, { onDelete: "cascade" }),
    expiresAt: timestamp({ withTimezone: true }).notNull(),
    usedAt: timestamp({ withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [index().on(t.expiresAt)],
);

/** Sessions clients, séparées de celles des organisateurs (Better Auth) : cookie à part. */
export const customerSession = pgTable(
  "customer_session",
  {
    tokenHash: text().primaryKey(),
    accountId: uuid()
      .notNull()
      .references(() => customerAccount.id, { onDelete: "cascade" }),
    expiresAt: timestamp({ withTimezone: true }).notNull(),
    createdAt: createdAt(),
  },
  (t) => [index().on(t.accountId), index().on(t.expiresAt)],
);
