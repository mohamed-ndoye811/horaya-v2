import type { CalendarFeedRepository } from "@horaya/core";
import { eq } from "drizzle-orm";
import type { Executor } from "../client";
import { calendarFeed } from "../schema";

export function calendarFeedRepository(db: Executor): CalendarFeedRepository {
  return {
    async ensure(organizationId, memberId, token) {
      // Deux premières demandes simultanées : la seconde retrouve le flux de la première.
      await db
        .insert(calendarFeed)
        .values({ organizationId, memberId, token })
        .onConflictDoNothing({ target: calendarFeed.memberId });
      const [found] = await db
        .select()
        .from(calendarFeed)
        .where(eq(calendarFeed.memberId, memberId));
      if (!found) throw new Error("Flux d'agenda non enregistré");
      return found;
    },

    async replaceToken(organizationId, memberId, token) {
      const [saved] = await db
        .insert(calendarFeed)
        .values({ organizationId, memberId, token })
        .onConflictDoUpdate({ target: calendarFeed.memberId, set: { token } })
        .returning();
      if (!saved) throw new Error("Flux d'agenda non enregistré");
      return saved;
    },
  };
}
