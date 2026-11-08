import type { FieldValues } from "../fields/model";
import type { AllocationKind, ItemUnitStatus } from "./types";

export interface Item {
  id: string;
  organizationId: string;
  itemTypeId: string | null;
  name: string;
  reference: string;
  description: string | null;
  dailyRateCents: number | null;
  depositCents: number | null;
  storageLocation: string | null;
  purchasedOn: string | null;
  purchasePriceCents: number | null;
  photoUrl: string | null;
  rentable: boolean;
  /** Valeurs des champs de sa catégorie (`item_type.fields`). */
  fieldValues: FieldValues;
  archivedAt: Date | null;
}

export interface ItemUnit {
  id: string;
  itemId: string;
  label: string;
  status: ItemUnitStatus;
}

export interface ItemAllocation {
  id: string;
  itemUnitId: string;
  kind: AllocationKind;
  eventId: string | null;
  bookingId: string | null;
  startsAt: Date;
  endsAt: Date;
  title: string | null;
  provider: string | null;
  costCents: number | null;
  note: string | null;
  /** Besoin du module Matériel avancé qui l'a réservé (réservation d'événement). */
  needId: string | null;
  cancelledAt: Date | null;
}

export type NewAllocation = Omit<ItemAllocation, "id" | "cancelledAt" | "needId"> & {
  needId?: string | null;
  organizationId: string;
  createdByMemberId: string | null;
};
