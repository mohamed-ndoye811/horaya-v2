import { type Actor, actorRef } from "../shared/actor";
import { ForbiddenError } from "../shared/errors";
import { generateToken } from "../shared/tokens";
import type { Deps } from "../shared/unit-of-work";
import type { CalendarFeed } from "./model";

/** Chaque membre a son propre flux, quel que soit son rôle : créé à la première demande. */
export async function getCalendarFeed(deps: Deps, actor: Actor): Promise<CalendarFeed> {
  if (actor.type !== "member") throw new ForbiddenError();
  return deps.uow.run((repositories) =>
    repositories.calendarFeeds.ensure(actor.organizationId, actor.memberId, generateToken()),
  );
}

/** Nouvelle adresse secrète (adresse partagée par erreur…) : l'ancienne cesse de marcher. */
export async function regenerateCalendarFeed(deps: Deps, actor: Actor): Promise<CalendarFeed> {
  if (actor.type !== "member") throw new ForbiddenError();
  return deps.uow.run(async (repositories) => {
    const feed = await repositories.calendarFeeds.replaceToken(
      actor.organizationId,
      actor.memberId,
      generateToken(),
    );
    await repositories.activity.record({
      organizationId: actor.organizationId,
      entityType: "calendar_feed",
      entityId: feed.id,
      action: "calendar_feed.regenerated",
      ...actorRef(actor),
    });
    return feed;
  });
}
