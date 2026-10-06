import { char, integer, timestamp, uuid } from "drizzle-orm/pg-core";
import { v7 as uuidv7 } from "uuid";
import { organization } from "./auth";

/** Clé primaire UUID v7 (triée dans le temps, meilleure pour les index que v4). */
export const id = () =>
  uuid()
    .primaryKey()
    .$defaultFn(() => uuidv7());

/** Rattachement au tenant : toute table métier en a un. */
export const organizationId = () =>
  uuid()
    .notNull()
    .references(() => organization.id, { onDelete: "cascade" });

export const createdAt = () => timestamp({ withTimezone: true }).defaultNow().notNull();

export const updatedAt = () =>
  timestamp({ withTimezone: true })
    .defaultNow()
    .notNull()
    .$onUpdate(() => new Date());

/** Montants toujours en centimes (entiers), jamais en flottants. */
export const cents = () => integer();

export const currency = () => char({ length: 3 }).notNull().default("EUR");
