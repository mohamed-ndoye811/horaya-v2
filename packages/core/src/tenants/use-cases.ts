import { type Actor, actorRef, assertMemberCan } from "../shared/actor";
import { ForbiddenError } from "../shared/errors";
import type { Deps } from "../shared/unit-of-work";
import { validate } from "../shared/validate";
import { type NotificationPreference, notificationPreferencesSchema } from "./notifications";
import { type UpdateTenantSettingsInput, updateTenantSettingsSchema } from "./settings-schemas";

/** Marque, paiements et politique d'annulation de l'espace (écrans 24 et 26). */
export async function updateTenantSettings(
  deps: Deps,
  actor: Actor,
  input: UpdateTenantSettingsInput,
): Promise<void> {
  assertMemberCan(actor, "settings", "update");
  const patch = validate(updateTenantSettingsSchema, input);
  if (Object.keys(patch).length === 0) return;

  await deps.uow.run(async (repositories) => {
    await repositories.settings.update(actor.organizationId, patch);
    await repositories.activity.record({
      organizationId: actor.organizationId,
      entityType: "settings",
      entityId: actor.organizationId,
      action: "settings.updated",
      ...actorRef(actor),
      data: { fields: Object.keys(patch) },
    });
  });
}

/** Chaque membre règle ses propres notifications, quel que soit son rôle. */
export async function saveNotificationPreferences(
  deps: Deps,
  actor: Actor,
  input: NotificationPreference[],
): Promise<void> {
  if (actor.type !== "member") throw new ForbiddenError();
  const preferences = validate(notificationPreferencesSchema, input);
  await deps.uow.run((repositories) =>
    repositories.notifications.save(actor.organizationId, actor.memberId, preferences),
  );
}
