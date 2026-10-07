import type { MemberRole } from "@horaya/core";

/** Libellés courts des rôles dans l'interface (écran 25). */
export const ROLE_LABELS: Record<MemberRole, string> = {
  owner: "Propriétaire",
  admin: "Admin",
  editor: "Éditeur",
  viewer: "Lecteur",
};

/** Rôles qu'on peut donner à un membre ou à une invitation (le propriétaire est unique). */
export const ASSIGNABLE_ROLES = [
  "admin",
  "editor",
  "viewer",
] as const satisfies readonly MemberRole[];
export type AssignableRole = (typeof ASSIGNABLE_ROLES)[number];

/** Rôles possibles par le lien d'invitation général : jamais admin, un lien peut circuler. */
export const JOIN_LINK_ROLES = ["viewer", "editor"] as const satisfies readonly AssignableRole[];

/** Gestion de l'équipe (inviter, changer un rôle, retirer) : propriétaire et admins. */
export const canManageTeam = (role: MemberRole) => role === "owner" || role === "admin";
