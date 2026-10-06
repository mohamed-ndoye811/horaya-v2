export const ITEM_UNIT_STATUSES = ["available", "maintenance", "retired"] as const;
export type ItemUnitStatus = (typeof ITEM_UNIT_STATUSES)[number];

export const ALLOCATION_KINDS = ["event", "rental", "maintenance", "block"] as const;
export type AllocationKind = (typeof ALLOCATION_KINDS)[number];
