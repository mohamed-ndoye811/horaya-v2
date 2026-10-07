import { can, type PermissionAction, type PermissionResource } from "../tenants/permissions";
import type { MemberRole } from "../tenants/types";
import { ForbiddenError } from "./errors";

/** Qui déclenche un cas d'usage. Toujours rattaché à un espace. */
export type Actor =
  | { type: "member"; organizationId: string; userId: string; memberId: string; role: MemberRole }
  /** Client sur la page publique ou via son lien « Gérer ma réservation ». */
  | { type: "customer"; organizationId: string }
  /** Tâche automatique (webhook, relance…). */
  | { type: "system"; organizationId: string };

/** Vérifie qu'un membre a la permission ; les autres acteurs sont filtrés par chaque cas d'usage. */
export function assertMemberCan<R extends PermissionResource>(
  actor: Actor,
  resource: R,
  action: PermissionAction<R>,
): asserts actor is Extract<Actor, { type: "member" }> {
  if (actor.type !== "member") throw new ForbiddenError();
  if (!can(actor.role, resource, action)) {
    throw new ForbiddenError("Ton rôle ne permet pas cette action");
  }
}

/** Identifiant à inscrire dans le journal d'activité. */
export function actorRef(actor: Actor): { actorType: Actor["type"]; actorId: string | null } {
  return { actorType: actor.type, actorId: actor.type === "member" ? actor.userId : null };
}
