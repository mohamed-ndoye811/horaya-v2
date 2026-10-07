import { type Actor, actorRef, assertMemberCan } from "../shared/actor";
import { NotFoundError, ValidationError } from "../shared/errors";
import type { Deps, Repositories } from "../shared/unit-of-work";
import { validate } from "../shared/validate";
import { slugify } from "../tenants/workspace";
import type { CalendarLink, CalendarLinkFilter } from "./model";
import { randomSlugSuffix } from "./rules";
import {
  type CreateCalendarLinkInput,
  createCalendarLinkSchema,
  type UpdateCalendarLinkInput,
  updateCalendarLinkSchema,
} from "./schemas";

async function assertOwnedSelection(
  repositories: Repositories,
  organizationId: string,
  filter: { filterMode: CalendarLinkFilter; filterIds: string[] },
) {
  if (filter.filterMode === "all") return;
  const owned = await repositories.calendarLinks.countOwned(
    organizationId,
    filter.filterMode,
    filter.filterIds,
  );
  if (owned !== filter.filterIds.length) {
    throw new ValidationError("Données invalides", [
      { path: "filterIds", message: "Un élément choisi n'existe plus" },
    ]);
  }
}

/** Nouveau lien calendrier : l'adresse reprend le nom, plus une partie aléatoire. */
export async function createCalendarLink(
  deps: Deps,
  actor: Actor,
  input: CreateCalendarLinkInput,
): Promise<CalendarLink> {
  assertMemberCan(actor, "event", "publish");
  const data = validate(createCalendarLinkSchema, input);
  return deps.uow.run(async (repositories) => {
    await assertOwnedSelection(repositories, actor.organizationId, data);
    const base = slugify(data.name).slice(0, 40).replace(/-+$/, "") || "calendrier";
    const link = await repositories.calendarLinks.insert({
      organizationId: actor.organizationId,
      name: data.name,
      slug: `${base}-${randomSlugSuffix()}`,
      filterMode: data.filterMode,
      filterIds: data.filterIds,
      isActive: true,
    });
    await repositories.activity.record({
      organizationId: actor.organizationId,
      entityType: "calendar_link",
      entityId: link.id,
      action: "calendar_link.created",
      ...actorRef(actor),
      data: { filterMode: link.filterMode },
    });
    return link;
  });
}

/** Renommer ne change pas l'adresse : les liens déjà partagés continuent de marcher. */
export async function updateCalendarLink(
  deps: Deps,
  actor: Actor,
  linkId: string,
  input: UpdateCalendarLinkInput,
): Promise<CalendarLink> {
  assertMemberCan(actor, "event", "publish");
  const data = validate(updateCalendarLinkSchema, input);
  return deps.uow.run(async (repositories) => {
    const found = await repositories.calendarLinks.find(actor.organizationId, linkId);
    if (!found) throw new NotFoundError("Lien calendrier", linkId);
    if (data.filter) await assertOwnedSelection(repositories, actor.organizationId, data.filter);
    const updated = await repositories.calendarLinks.update(actor.organizationId, linkId, {
      ...(data.name !== undefined ? { name: data.name } : {}),
      ...(data.filter ?? {}),
      ...(data.isActive !== undefined ? { isActive: data.isActive } : {}),
    });
    await repositories.activity.record({
      organizationId: actor.organizationId,
      entityType: "calendar_link",
      entityId: linkId,
      action: "calendar_link.updated",
      ...actorRef(actor),
      data: { fields: Object.keys(data) },
    });
    return updated;
  });
}

/** Supprimer un lien : son adresse cesse aussitôt de marcher (les réservations restent). */
export async function deleteCalendarLink(deps: Deps, actor: Actor, linkId: string) {
  assertMemberCan(actor, "event", "delete");
  await deps.uow.run(async (repositories) => {
    const found = await repositories.calendarLinks.find(actor.organizationId, linkId);
    if (!found) throw new NotFoundError("Lien calendrier", linkId);
    await repositories.calendarLinks.delete(actor.organizationId, linkId);
    await repositories.activity.record({
      organizationId: actor.organizationId,
      entityType: "calendar_link",
      entityId: linkId,
      action: "calendar_link.deleted",
      ...actorRef(actor),
      data: { name: found.name },
    });
  });
}
