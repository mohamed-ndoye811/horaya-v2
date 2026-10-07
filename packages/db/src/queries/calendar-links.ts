import type { CalendarLink } from "@horaya/core";
import { and, asc, count, eq, gte, inArray, or } from "drizzle-orm";
import type { Executor } from "../client";
import { calendarLink, event } from "../schema";

/** Condition SQL sur `event` : les événements que montre un lien (sans le statut ni la date). */
export function calendarLinkCondition(link: Pick<CalendarLink, "filterMode" | "filterIds">) {
  if (link.filterMode === "events") return inArray(event.id, link.filterIds);
  if (link.filterMode === "event_types") return inArray(event.eventTypeId, link.filterIds);
  return undefined;
}

/** Liens calendrier de l'espace (écran « Liens calendrier »), avec leurs événements à venir. */
export async function listCalendarLinks(db: Executor, organizationId: string, now: Date) {
  const links = await db
    .select()
    .from(calendarLink)
    .where(eq(calendarLink.organizationId, organizationId))
    .orderBy(asc(calendarLink.createdAt));
  return Promise.all(
    links.map(async (link) => {
      const [row] = await db
        .select({ value: count() })
        .from(event)
        .where(
          and(
            eq(event.organizationId, organizationId),
            eq(event.status, "published"),
            gte(event.startsAt, now),
            calendarLinkCondition(link),
          ),
        );
      return { ...link, upcomingEvents: row?.value ?? 0 };
    }),
  );
}

/** Événements proposés dans le choix d'un lien : à venir, publiés ou brouillons. */
export async function listLinkableEvents(db: Executor, organizationId: string, now: Date) {
  return db
    .select({
      id: event.id,
      title: event.title,
      startsAt: event.startsAt,
      visibility: event.visibility,
      status: event.status,
    })
    .from(event)
    .where(
      and(
        eq(event.organizationId, organizationId),
        or(eq(event.status, "published"), eq(event.status, "draft")),
        gte(event.endsAt, now),
      ),
    )
    .orderBy(asc(event.startsAt))
    .limit(300);
}
