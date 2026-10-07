import type { MemberRole } from "./types";

/**
 * Permissions métier d'un espace, source unique : Better Auth (packages/auth) en dérive
 * son contrôle d'accès, et les cas d'usage du core les vérifient.
 * La lecture n'est pas une permission : tout membre voit les données de son espace.
 */
export const PERMISSION_STATEMENTS = {
  event: ["create", "update", "delete", "publish"],
  booking: ["create", "update", "cancel", "refund"],
  customer: ["create", "update", "delete", "export"],
  inventory: ["create", "update", "delete"],
  settings: ["update"],
  billing: ["manage"],
} as const;

export type PermissionResource = keyof typeof PERMISSION_STATEMENTS;
export type PermissionAction<R extends PermissionResource> =
  (typeof PERMISSION_STATEMENTS)[R][number];

type RolePermissions = { [R in PermissionResource]?: ReadonlyArray<PermissionAction<R>> };

const BUSINESS_ALL = {
  event: PERMISSION_STATEMENTS.event,
  booking: PERMISSION_STATEMENTS.booking,
  customer: PERMISSION_STATEMENTS.customer,
  inventory: PERMISSION_STATEMENTS.inventory,
} as const;

export const ROLE_PERMISSIONS = {
  /** Tout, y compris la facturation et la suppression de l'espace. */
  owner: { ...BUSINESS_ALL, settings: ["update"], billing: ["manage"] },
  /** Tout sauf la facturation et la suppression de l'espace. */
  admin: { ...BUSINESS_ALL, settings: ["update"] },
  /** Gère l'activité au quotidien, sans réglages, suppressions ni remboursements. */
  editor: {
    event: ["create", "update", "publish"],
    booking: ["create", "update", "cancel"],
    customer: ["create", "update"],
    inventory: ["create", "update"],
  },
  /** Consultation seule. */
  viewer: {},
} as const satisfies Record<MemberRole, RolePermissions>;

export function can<R extends PermissionResource>(
  role: MemberRole,
  resource: R,
  action: PermissionAction<R>,
): boolean {
  const granted = (ROLE_PERMISSIONS[role] as RolePermissions)[resource] as
    | ReadonlyArray<string>
    | undefined;
  return granted?.includes(action) ?? false;
}
