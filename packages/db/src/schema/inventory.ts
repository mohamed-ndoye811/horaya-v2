import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  date,
  index,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";
import { cents, createdAt, id, organizationId, updatedAt } from "./_columns";
import { member } from "./auth";
import { booking } from "./bookings";
import { allocationKind, itemUnitStatus } from "./enums";
import { event } from "./events";

export const itemType = pgTable(
  "item_type",
  {
    id: id(),
    organizationId: organizationId(),
    name: text().notNull(),
    color: text(),
    description: text(),
    archivedAt: timestamp({ withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [unique().on(t.organizationId, t.name)],
);

export const item = pgTable(
  "item",
  {
    id: id(),
    organizationId: organizationId(),
    itemTypeId: uuid().references(() => itemType.id, { onDelete: "set null" }),
    name: text().notNull(),
    reference: text().notNull(),
    description: text(),
    dailyRateCents: cents(),
    depositCents: cents(),
    storageLocation: text(),
    purchasedOn: date(),
    purchasePriceCents: cents(),
    photoUrl: text(),
    /** Louable seul par un client final (sinon réservé aux événements de l'organisateur). */
    rentable: boolean().notNull().default(false),
    archivedAt: timestamp({ withTimezone: true }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [unique().on(t.organizationId, t.reference), index().on(t.organizationId, t.itemTypeId)],
);

/** Chaque exemplaire physique d'un article (#1, #2…). La quantité = nombre d'exemplaires. */
export const itemUnit = pgTable(
  "item_unit",
  {
    id: id(),
    organizationId: organizationId(),
    itemId: uuid()
      .notNull()
      .references(() => item.id, { onDelete: "cascade" }),
    label: text().notNull(),
    serialNumber: text(),
    status: itemUnitStatus().notNull().default("available"),
    createdAt: createdAt(),
  },
  (t) => [unique().on(t.itemId, t.label)],
);

/**
 * Ce qui occupe un exemplaire sur une période : un événement, une location,
 * une maintenance ou un blocage manuel. Le chevauchement est interdit par
 * une contrainte d'exclusion Postgres (voir la migration `item_allocation_no_overlap`).
 */
export const itemAllocation = pgTable(
  "item_allocation",
  {
    id: id(),
    organizationId: organizationId(),
    itemUnitId: uuid()
      .notNull()
      .references(() => itemUnit.id, { onDelete: "cascade" }),
    kind: allocationKind().notNull(),
    eventId: uuid().references(() => event.id, { onDelete: "cascade" }),
    bookingId: uuid().references(() => booking.id, { onDelete: "cascade" }),
    startsAt: timestamp({ withTimezone: true }).notNull(),
    endsAt: timestamp({ withTimezone: true }).notNull(),
    /** Maintenance : intitulé, prestataire et coût. */
    title: text(),
    provider: text(),
    costCents: cents(),
    note: text(),
    createdByMemberId: uuid().references(() => member.id, { onDelete: "set null" }),
    cancelledAt: timestamp({ withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [
    index().on(t.itemUnitId, t.startsAt),
    index().on(t.eventId),
    index().on(t.bookingId),
    check("item_allocation_period_valid", sql`${t.endsAt} > ${t.startsAt}`),
    check(
      "item_allocation_kind_target",
      sql`(${t.kind} = 'event' AND ${t.eventId} IS NOT NULL)
        OR (${t.kind} = 'rental' AND ${t.bookingId} IS NOT NULL)
        OR ${t.kind} IN ('maintenance', 'block')`,
    ),
  ],
);
