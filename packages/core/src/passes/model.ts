import type { BookingSource, PaymentMethod } from "../bookings/types";
import type { ActorType } from "../tenants/types";
import type { PassMovementKind, PassStatus } from "./types";

/** Formule de carte vendue par l'organisateur (ex. « Carte 10 séances »). */
export interface PassPlan {
  id: string;
  organizationId: string;
  name: string;
  sessions: number;
  priceCents: number;
  validityDays: number;
  /** Types d'événements acceptés ; vide = tous. */
  eventTypeIds: string[];
  archivedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Carte d'un client. Les conditions de la formule sont copiées à la vente : modifier la
 * formule ne change pas les cartes déjà vendues. Le solde n'est pas stocké : il se déduit
 * du journal (PassMovement).
 */
export interface Pass {
  id: string;
  organizationId: string;
  customerId: string;
  planId: string | null;
  name: string;
  sessionsTotal: number;
  priceCents: number;
  validityDays: number;
  eventTypeIds: string[];
  status: PassStatus;
  source: BookingSource;
  paymentMethod: PaymentMethod | null;
  activatedAt: Date | null;
  /** Fin de validité, fixée au paiement. */
  expiresAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface PassMovement {
  id: string;
  organizationId: string;
  passId: string;
  kind: PassMovementKind;
  /** Séances ajoutées (+) ou retirées (−). */
  delta: number;
  bookingId: string | null;
  reason: string | null;
  actorType: ActorType;
  createdAt: Date;
}
