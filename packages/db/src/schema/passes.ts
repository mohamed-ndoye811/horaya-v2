import { sql } from "drizzle-orm";
import {
  check,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { cents, createdAt, id, organizationId, updatedAt } from "./_columns";
import { booking } from "./bookings";
import { customer } from "./customers";
import { actorType, bookingSource, passMovementKind, passStatus, paymentMethod } from "./enums";

/** Formule de carte de séances vendue par l'organisateur. */
export const passPlan = pgTable(
  "pass_plan",
  {
    id: id(),
    organizationId: organizationId(),
    name: text().notNull(),
    sessions: integer().notNull(),
    priceCents: cents().notNull(),
    validityDays: integer().notNull(),
    /** Types d'événements acceptés ; vide = tous. */
    eventTypeIds: uuid().array().notNull().default(sql`'{}'::uuid[]`),
    archivedAt: timestamp({ withTimezone: true }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index().on(t.organizationId),
    check("pass_plan_sessions_positive", sql`${t.sessions} > 0`),
    check("pass_plan_validity_positive", sql`${t.validityDays} > 0`),
  ],
);

/** Carte d'un client : conditions copiées de la formule à la vente. Pas de solde stocké. */
export const pass = pgTable(
  "pass",
  {
    id: id(),
    organizationId: organizationId(),
    customerId: uuid()
      .notNull()
      .references(() => customer.id, { onDelete: "restrict" }),
    planId: uuid().references(() => passPlan.id, { onDelete: "set null" }),
    name: text().notNull(),
    sessionsTotal: integer().notNull(),
    priceCents: cents().notNull(),
    validityDays: integer().notNull(),
    eventTypeIds: uuid().array().notNull().default(sql`'{}'::uuid[]`),
    status: passStatus().notNull().default("pending"),
    source: bookingSource().notNull(),
    paymentMethod: paymentMethod(),
    activatedAt: timestamp({ withTimezone: true }),
    expiresAt: timestamp({ withTimezone: true }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index().on(t.organizationId, t.status), index().on(t.customerId)],
);

/** Journal d'une carte : le solde est la somme des `delta`. On n'efface ni ne modifie jamais une ligne. */
export const passMovement = pgTable(
  "pass_movement",
  {
    id: id(),
    organizationId: organizationId(),
    passId: uuid()
      .notNull()
      .references(() => pass.id, { onDelete: "restrict" }),
    kind: passMovementKind().notNull(),
    delta: integer().notNull(),
    bookingId: uuid().references(() => booking.id, { onDelete: "restrict" }),
    reason: text(),
    actorType: actorType().notNull(),
    createdAt: createdAt(),
  },
  (t) => [
    index().on(t.passId, t.createdAt),
    // Une réservation ne consomme (et ne recrédite) qu'une seule fois : filet sous le verrou.
    uniqueIndex("pass_movement_booking_kind_unique").on(t.bookingId, t.kind),
    check("pass_movement_delta_nonzero", sql`${t.delta} <> 0`),
  ],
);
