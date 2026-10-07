import { createAccessControl } from "better-auth/plugins/access";
import { adminAc, defaultStatements, ownerAc } from "better-auth/plugins/organization/access";

/**
 * Permissions métier d'un espace. La lecture n'est pas une permission :
 * tout membre voit les données de son espace (le rôle « viewer » s'arrête là).
 */
export const statements = {
  ...defaultStatements,
  event: ["create", "update", "delete", "publish"],
  booking: ["create", "update", "cancel", "refund"],
  customer: ["create", "update", "delete", "export"],
  inventory: ["create", "update", "delete"],
  settings: ["update"],
  billing: ["manage"],
} as const;

export const ac = createAccessControl(statements);

const businessAll = {
  event: ["create", "update", "delete", "publish"],
  booking: ["create", "update", "cancel", "refund"],
  customer: ["create", "update", "delete", "export"],
  inventory: ["create", "update", "delete"],
} as const;

/** Tout, y compris la facturation et la suppression de l'espace. */
export const owner = ac.newRole({
  ...ownerAc.statements,
  ...businessAll,
  settings: ["update"],
  billing: ["manage"],
});

/** Tout sauf la facturation et la suppression de l'espace. */
export const admin = ac.newRole({
  ...adminAc.statements,
  ...businessAll,
  settings: ["update"],
});

/** Gère l'activité au quotidien, sans réglages ni gestion de l'équipe. */
export const editor = ac.newRole({
  event: ["create", "update", "publish"],
  booking: ["create", "update", "cancel"],
  customer: ["create", "update"],
  inventory: ["create", "update"],
});

/** Consultation seule. */
export const viewer = ac.newRole({});

export const roles = { owner, admin, editor, viewer };
