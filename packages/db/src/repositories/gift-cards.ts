import {
  DEFAULT_GIFT_CARD_SETTINGS,
  type GiftCard,
  type GiftCardMovement,
  type GiftCardRepository,
} from "@horaya/core";
import { and, asc, eq, inArray } from "drizzle-orm";
import type { Executor } from "../client";
import { giftCard, giftCardMovement, organization, tenantSettings } from "../schema";

export function giftCardRepository(db: Executor): GiftCardRepository {
  const lockWhere = (where: ReturnType<typeof and>) =>
    db.select().from(giftCard).where(where).for("update");

  return {
    async insert(card) {
      const [created] = await db.insert(giftCard).values(card).onConflictDoNothing().returning();
      return (created as GiftCard | undefined) ?? null;
    },

    async lock(organizationId, giftCardId) {
      const [found] = await lockWhere(
        and(eq(giftCard.organizationId, organizationId), eq(giftCard.id, giftCardId)),
      );
      return (found as GiftCard | undefined) ?? null;
    },

    async lockByCode(organizationId, code) {
      const [found] = await lockWhere(
        and(eq(giftCard.organizationId, organizationId), eq(giftCard.code, code)),
      );
      return (found as GiftCard | undefined) ?? null;
    },

    async update(organizationId, giftCardId, patch) {
      const [updated] = await db
        .update(giftCard)
        .set(patch)
        .where(and(eq(giftCard.organizationId, organizationId), eq(giftCard.id, giftCardId)))
        .returning();
      if (!updated) throw new Error("Bon cadeau introuvable");
      return updated as GiftCard;
    },

    async addMovement(movement) {
      const [created] = await db.insert(giftCardMovement).values(movement).returning();
      if (!created) throw new Error("Mouvement non enregistré");
      return created as GiftCardMovement;
    },

    async listMovements(giftCardId) {
      return (await db
        .select()
        .from(giftCardMovement)
        .where(eq(giftCardMovement.giftCardId, giftCardId))
        .orderBy(asc(giftCardMovement.createdAt))) as GiftCardMovement[];
    },

    async listBookingMovements(bookingId) {
      return (await db
        .select()
        .from(giftCardMovement)
        .where(
          and(
            eq(giftCardMovement.bookingId, bookingId),
            inArray(giftCardMovement.kind, ["use", "restore"]),
          ),
        )
        .orderBy(asc(giftCardMovement.createdAt))) as GiftCardMovement[];
    },

    async getSettings(organizationId) {
      const [row] = await db
        .select({ giftCards: tenantSettings.giftCards })
        .from(tenantSettings)
        .where(eq(tenantSettings.organizationId, organizationId));
      return { ...DEFAULT_GIFT_CARD_SETTINGS, ...row?.giftCards };
    },

    async setSettings(organizationId, settings) {
      await db
        .insert(tenantSettings)
        .values({ organizationId, giftCards: settings })
        .onConflictDoUpdate({
          target: tenantSettings.organizationId,
          set: { giftCards: settings, updatedAt: new Date() },
        });
    },

    async organizationName(organizationId) {
      const [row] = await db
        .select({ name: organization.name })
        .from(organization)
        .where(eq(organization.id, organizationId));
      return row?.name ?? "";
    },
  };
}
