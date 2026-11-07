import { sql } from "drizzle-orm";
import { check, index, integer, pgTable, text, timestamp, unique, uuid } from "drizzle-orm/pg-core";
import { cents, createdAt, currency, id, organizationId } from "./_columns";
import { booking } from "./bookings";
import { giftCardMovementKind, giftCardSource, giftCardStatus } from "./enums";

/** Bon cadeau. Le solde n'est pas stocké : c'est la somme de ses mouvements. */
export const giftCard = pgTable(
  "gift_card",
  {
    id: id(),
    organizationId: organizationId(),
    code: text().notNull(),
    status: giftCardStatus().notNull().default("pending"),
    initialCents: cents().notNull(),
    currency: currency(),
    purchaserName: text().notNull(),
    purchaserEmail: text().notNull(),
    recipientName: text().notNull(),
    recipientEmail: text(),
    message: text(),
    source: giftCardSource().notNull(),
    /** Jeton de la page imprimable (accès au bon, comme le code). */
    viewToken: text().notNull(),
    paidAt: timestamp({ withTimezone: true }),
    expiresAt: timestamp({ withTimezone: true }),
    cancelledAt: timestamp({ withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [
    unique().on(t.organizationId, t.code),
    unique().on(t.viewToken),
    index().on(t.organizationId, t.createdAt),
    index().on(t.organizationId, t.purchaserEmail),
    index().on(t.organizationId, t.recipientEmail),
    check("gift_card_amount_positive", sql`${t.initialCents} > 0`),
  ],
);

/** Journal des mouvements d'un bon : jamais modifié, jamais supprimé. */
export const giftCardMovement = pgTable(
  "gift_card_movement",
  {
    id: id(),
    organizationId: organizationId(),
    giftCardId: uuid()
      .notNull()
      .references(() => giftCard.id, { onDelete: "restrict" }),
    kind: giftCardMovementKind().notNull(),
    amountCents: integer().notNull(),
    bookingId: uuid().references(() => booking.id, { onDelete: "restrict" }),
    note: text(),
    createdAt: createdAt(),
  },
  (t) => [
    index().on(t.giftCardId, t.createdAt),
    index().on(t.bookingId),
    check("gift_card_movement_not_zero", sql`${t.amountCents} <> 0`),
  ],
);
