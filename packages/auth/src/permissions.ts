import { PERMISSION_STATEMENTS, ROLE_PERMISSIONS } from "@horaya/core";
import { createAccessControl } from "better-auth/plugins/access";
import { adminAc, defaultStatements, ownerAc } from "better-auth/plugins/organization/access";

/**
 * Contrôle d'accès Better Auth, dérivé des permissions du core (source unique) :
 * on y ajoute seulement la gestion de l'espace et de l'équipe propre à Better Auth.
 */
export const statements = { ...defaultStatements, ...PERMISSION_STATEMENTS } as const;

export const ac = createAccessControl(statements);

export const roles = {
  owner: ac.newRole({ ...ownerAc.statements, ...ROLE_PERMISSIONS.owner }),
  admin: ac.newRole({ ...adminAc.statements, ...ROLE_PERMISSIONS.admin }),
  editor: ac.newRole({ ...ROLE_PERMISSIONS.editor }),
  viewer: ac.newRole({ ...ROLE_PERMISSIONS.viewer }),
};
