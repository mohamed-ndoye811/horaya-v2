import type { Pass, PassMovement, PassPlan } from "./model";
import type { PassMovementKind } from "./types";

export type PassPlanData = Pick<
  PassPlan,
  "name" | "sessions" | "priceCents" | "validityDays" | "eventTypeIds"
>;

export type NewPass = Omit<
  Pass,
  "id" | "createdAt" | "updatedAt" | "activatedAt" | "expiresAt" | "paymentMethod"
>;

export type NewPassMovement = Omit<PassMovement, "id" | "createdAt" | "kind"> & {
  kind: PassMovementKind;
};

export interface PassRepository {
  insertPlan(organizationId: string, data: PassPlanData): Promise<PassPlan>;
  updatePlan(
    organizationId: string,
    planId: string,
    patch: Partial<PassPlanData> & { archivedAt?: Date | null },
  ): Promise<PassPlan>;
  findPlan(organizationId: string, planId: string): Promise<PassPlan | null>;
  insert(pass: NewPass): Promise<Pass>;
  find(organizationId: string, passId: string): Promise<Pass | null>;
  /** Relit la carte en la verrouillant jusqu'à la fin de la transaction (une utilisation à la fois). */
  lock(organizationId: string, passId: string): Promise<Pass | null>;
  update(
    organizationId: string,
    passId: string,
    patch: Partial<Pick<Pass, "status" | "activatedAt" | "expiresAt" | "paymentMethod">>,
  ): Promise<Pass>;
  insertMovement(movement: NewPassMovement): Promise<PassMovement>;
  /** Somme du journal de la carte. */
  balance(passId: string): Promise<number>;
  findMovementForBooking(bookingId: string, kind: PassMovementKind): Promise<PassMovement | null>;
}
