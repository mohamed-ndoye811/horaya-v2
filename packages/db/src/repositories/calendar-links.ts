import type { CalendarLink, CalendarLinkRepository } from "@horaya/core";
import { and, count, eq, inArray } from "drizzle-orm";
import type { Executor } from "../client";
import { calendarLink, event, eventType } from "../schema";

export function calendarLinkRepository(db: Executor): CalendarLinkRepository {
  const byId = (organizationId: string, linkId: string) =>
    and(eq(calendarLink.organizationId, organizationId), eq(calendarLink.id, linkId));

  return {
    async insert(link) {
      const [created] = await db.insert(calendarLink).values(link).returning();
      if (!created) throw new Error("Lien calendrier non créé");
      return created as CalendarLink;
    },

    async find(organizationId, linkId) {
      const [found] = await db.select().from(calendarLink).where(byId(organizationId, linkId));
      return (found as CalendarLink | undefined) ?? null;
    },

    async findBySlug(organizationId, slug) {
      const [found] = await db
        .select()
        .from(calendarLink)
        .where(and(eq(calendarLink.organizationId, organizationId), eq(calendarLink.slug, slug)));
      return (found as CalendarLink | undefined) ?? null;
    },

    async update(organizationId, linkId, patch) {
      const [updated] = await db
        .update(calendarLink)
        .set(patch)
        .where(byId(organizationId, linkId))
        .returning();
      if (!updated) throw new Error(`Lien calendrier introuvable : ${linkId}`);
      return updated as CalendarLink;
    },

    async delete(organizationId, linkId) {
      await db.delete(calendarLink).where(byId(organizationId, linkId));
    },

    async countOwned(organizationId, kind, ids) {
      if (ids.length === 0) return 0;
      const table = kind === "events" ? event : eventType;
      const [row] = await db
        .select({ value: count() })
        .from(table)
        .where(and(eq(table.organizationId, organizationId), inArray(table.id, ids)));
      return row?.value ?? 0;
    },
  };
}
