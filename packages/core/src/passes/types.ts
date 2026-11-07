export const PASS_STATUSES = ["pending", "active", "cancelled"] as const;
/** « pending » : vendue, pas encore payée ; « active » : payée, utilisable ; « cancelled » : vente annulée. */
export type PassStatus = (typeof PASS_STATUSES)[number];

/** Mouvements du journal d'une carte : achat, utilisation, recrédit (annulation), ajustement manuel. */
export const PASS_MOVEMENT_KINDS = ["purchase", "use", "recredit", "adjustment"] as const;
export type PassMovementKind = (typeof PASS_MOVEMENT_KINDS)[number];
