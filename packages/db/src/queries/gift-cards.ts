import {
  DEFAULT_GIFT_CARD_SETTINGS,
  type GiftCard,
  type GiftCardMovement,
  type GiftCardState,
  giftCardState,
} from "@horaya/core";
import { and, asc, desc, eq, ilike, or, sql } from "drizzle-orm";
import type { Executor } from "../client";
import { booking, giftCard, giftCardMovement, tenantSettings } from "../schema";

/** Solde d'un bon : somme de son journal. */
const balance = sql<number>`coalesce((
  select sum(m.amount_cents) from gift_card_movement m where m.gift_card_id = "gift_card"."id"
), 0)::int`;

export type GiftCardRow = GiftCard & { balanceCents: number; state: GiftCardState };

const withState = (
  rows: Array<{ card: unknown; balanceCents: number }>,
  now: Date,
): GiftCardRow[] =>
  rows.map(({ card, balanceCents }) => {
    const value = card as GiftCard;
    return { ...value, balanceCents, state: giftCardState(value, balanceCents, now) };
  });

export async function getGiftCardSettings(db: Executor, organizationId: string) {
  const [row] = await db
    .select({ giftCards: tenantSettings.giftCards })
    .from(tenantSettings)
    .where(eq(tenantSettings.organizationId, organizationId));
  return { ...DEFAULT_GIFT_CARD_SETTINGS, ...row?.giftCards };
}

/** Liste des bons de l'espace, les plus récents d'abord (recherche : code, acheteur, bénéficiaire). */
export async function listGiftCards(
  db: Executor,
  organizationId: string,
  now: Date,
  search?: string,
): Promise<GiftCardRow[]> {
  const term = search?.trim().replace(/[%_\\]/g, "\\$&");
  const rows = await db
    .select({ card: giftCard, balanceCents: balance })
    .from(giftCard)
    .where(
      and(
        eq(giftCard.organizationId, organizationId),
        term
          ? or(
              ilike(giftCard.code, `%${term}%`),
              ilike(giftCard.purchaserName, `%${term}%`),
              ilike(giftCard.recipientName, `%${term}%`),
            )
          : undefined,
      ),
    )
    .orderBy(desc(giftCard.createdAt))
    .limit(500);
  return withState(rows, now);
}

/** Un bon avec son journal ; les mouvements liés à une réservation en portent la référence. */
export async function getGiftCardDetail(
  db: Executor,
  organizationId: string,
  giftCardId: string,
  now: Date,
) {
  const [row] = await db
    .select({ card: giftCard, balanceCents: balance })
    .from(giftCard)
    .where(and(eq(giftCard.organizationId, organizationId), eq(giftCard.id, giftCardId)));
  if (!row) return null;
  const movements = await db
    .select({
      movement: giftCardMovement,
      bookingReference: booking.reference,
    })
    .from(giftCardMovement)
    .leftJoin(booking, eq(booking.id, giftCardMovement.bookingId))
    .where(eq(giftCardMovement.giftCardId, giftCardId))
    .orderBy(asc(giftCardMovement.createdAt));
  const [card] = withState([row], now);
  return {
    card: card as GiftCardRow,
    movements: movements.map((entry) => ({
      ...(entry.movement as GiftCardMovement),
      bookingReference: entry.bookingReference,
    })),
  };
}

/** Page imprimable d'un bon, retrouvée par son jeton. */
export async function getGiftCardByViewToken(
  db: Executor,
  organizationId: string,
  viewToken: string,
  now: Date,
) {
  const [row] = await db
    .select({ card: giftCard, balanceCents: balance })
    .from(giftCard)
    .where(and(eq(giftCard.organizationId, organizationId), eq(giftCard.viewToken, viewToken)));
  return row ? (withState([row], now)[0] ?? null) : null;
}

/** Bons utilisables d'un e-mail (acheteur ou bénéficiaire) : pour l'espace client. */
export async function listUsableGiftCardsForEmail(
  db: Executor,
  organizationId: string,
  email: string,
  now: Date,
) {
  const address = email.trim().toLowerCase();
  const rows = await db
    .select({ card: giftCard, balanceCents: balance })
    .from(giftCard)
    .where(
      and(
        eq(giftCard.organizationId, organizationId),
        eq(giftCard.status, "active"),
        or(
          sql`lower(${giftCard.recipientEmail}) = ${address}`,
          sql`lower(${giftCard.purchaserEmail}) = ${address}`,
        ),
      ),
    )
    .orderBy(asc(giftCard.expiresAt));
  return withState(rows, now).filter((card) => card.state === "active");
}
