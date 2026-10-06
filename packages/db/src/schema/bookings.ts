import { sql } from "drizzle-orm";
import {
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
import { customer } from "./customers";
import {
  bookingKind,
  bookingPaymentStatus,
  bookingSource,
  bookingStatus,
  paymentKind,
  paymentMode,
  paymentRecordStatus,
} from "./enums";
import { event } from "./events";

/**
 * Une réservation porte soit sur un événement (`kind = event`),
 * soit sur une location de matériel seule (`kind = rental`, lignes dans item_allocation).
 */
export const booking = pgTable(
  "booking",
  {
    id: id(),
    organizationId: organizationId(),
    reference: text().notNull(),
    kind: bookingKind().notNull().default("event"),
    eventId: uuid().references(() => event.id, { onDelete: "restrict" }),
    customerId: uuid()
      .notNull()
      .references(() => customer.id, { onDelete: "restrict" }),
    seats: integer().notNull().default(1),
    status: bookingStatus().notNull(),
    rentalStartsAt: timestamp({ withTimezone: true }),
    rentalEndsAt: timestamp({ withTimezone: true }),
    amountCents: cents().notNull().default(0),
    currency: currency(),
    paymentMode: paymentMode().notNull().default("free"),
    paymentStatus: bookingPaymentStatus().notNull().default("none"),
    depositCents: cents(),
    customerMessage: text(),
    refusalReason: text(),
    source: bookingSource().notNull(),
    /** Hash du jeton du lien « Gérer ma réservation » (jamais le jeton en clair). */
    manageTokenHash: text(),
    confirmedAt: timestamp({ withTimezone: true }),
    cancelledAt: timestamp({ withTimezone: true }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    unique().on(t.organizationId, t.reference),
    index().on(t.organizationId, t.status, t.createdAt),
    index().on(t.eventId, t.status),
    index().on(t.customerId),
    check("booking_seats_positive", sql`${t.seats} > 0`),
    check("booking_amount_positive", sql`${t.amountCents} >= 0`),
    check(
      "booking_kind_target",
      sql`(${t.kind} = 'event' AND ${t.eventId} IS NOT NULL)
        OR (${t.kind} = 'rental' AND ${t.rentalStartsAt} IS NOT NULL
            AND ${t.rentalEndsAt} > ${t.rentalStartsAt})`,
    ),
  ],
);

export const bookingParticipant = pgTable(
  "booking_participant",
  {
    id: id(),
    bookingId: uuid()
      .notNull()
      .references(() => booking.id, { onDelete: "cascade" }),
    firstName: text().notNull(),
    lastName: text().notNull(),
    email: text(),
    /** Réponses aux champs personnalisés du type d'événement, par clé. */
    customAnswers: jsonb().$type<Record<string, string | boolean>>().notNull().default({}),
    checkedInAt: timestamp({ withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [index().on(t.bookingId)],
);

/** Chaque mouvement d'argent (Stripe) : paiement, acompte, solde, remboursement. */
export const payment = pgTable(
  "payment",
  {
    id: id(),
    organizationId: organizationId(),
    bookingId: uuid()
      .notNull()
      .references(() => booking.id, { onDelete: "restrict" }),
    kind: paymentKind().notNull(),
    status: paymentRecordStatus().notNull(),
    amountCents: cents().notNull(),
    currency: currency(),
    provider: text().notNull().default("stripe"),
    providerReference: text(),
    createdAt: createdAt(),
  },
  (t) => [
    index().on(t.bookingId),
    unique().on(t.provider, t.providerReference),
    check("payment_amount_positive", sql`${t.amountCents} > 0`),
  ],
);
