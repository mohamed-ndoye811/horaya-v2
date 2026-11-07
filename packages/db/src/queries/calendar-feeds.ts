import { and, asc, eq, gt, isNotNull, lt, or, sql } from "drizzle-orm";
import type { Executor } from "../client";
import { calendarFeed, event, member, organization } from "../schema";

/** Espace du flux d'agenda, si le jeton existe et que son membre fait toujours partie de l'espace. */
export async function findCalendarFeedByToken(db: Executor, token: string) {
  const [row] = await db
    .select({
      organizationId: organization.id,
      organizationName: organization.name,
    })
    .from(calendarFeed)
    .innerJoin(
      member,
      and(
        eq(member.id, calendarFeed.memberId),
        eq(member.organizationId, calendarFeed.organizationId),
      ),
    )
    .innerJoin(organization, eq(organization.id, calendarFeed.organizationId))
    .where(eq(calendarFeed.token, token));
  return row ?? null;
}

/**
 * Événements du flux d'agenda : publiés, ou annulés après publication (l'agenda les retire),
 * sur la période donnée. Aucune donnée de client : seulement le nombre de places prises.
 */
export async function listCalendarFeedEvents(
  db: Executor,
  organizationId: string,
  range: { from: Date; to: Date },
) {
  return db
    .select({
      id: event.id,
      title: event.title,
      status: event.status,
      startsAt: event.startsAt,
      endsAt: event.endsAt,
      locationName: event.locationName,
      locationAddress: event.locationAddress,
      onlineUrl: event.onlineUrl,
      capacity: event.capacity,
      updatedAt: event.updatedAt,
      seatsHeld: sql<number>`coalesce((
        select sum(b.seats) from booking b
        where b.event_id = "event"."id" and b.status in ('pending', 'confirmed')
      ), 0)::int`,
    })
    .from(event)
    .where(
      and(
        eq(event.organizationId, organizationId),
        or(
          eq(event.status, "published"),
          and(eq(event.status, "cancelled"), isNotNull(event.publishedAt)),
        ),
        lt(event.startsAt, range.to),
        gt(event.endsAt, range.from),
      ),
    )
    .orderBy(asc(event.startsAt))
    .limit(2000);
}
