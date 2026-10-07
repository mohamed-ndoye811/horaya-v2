import type { EventStatus, EventVisibility, PaymentMode } from "./types";

/** Champ personnalisé demandé à la réservation (ex. régime alimentaire). */
export interface CustomFieldDefinition {
  key: string;
  label: string;
  type: "text" | "select" | "checkbox";
  required: boolean;
  options?: string[];
}

export interface BookingRules {
  /** Délai minimum avant le début pour réserver en ligne, en heures. */
  minAdvanceHours?: number;
  /** Places maximum par réservation en ligne. */
  maxSeatsPerBooking?: number;
  /** Quand c'est complet, les demandes passent en liste d'attente au lieu d'être refusées. */
  waitlistEnabled?: boolean;
}

export interface EventType {
  id: string;
  organizationId: string;
  name: string;
  color: string;
  description: string | null;
  defaultDurationMinutes: number | null;
  defaultPriceCents: number | null;
  defaultCapacity: number | null;
  requiresApproval: boolean;
  customFields: CustomFieldDefinition[];
  bookingRules: BookingRules;
  archivedAt: Date | null;
}

export interface Event {
  id: string;
  organizationId: string;
  eventTypeId: string;
  seriesId: string | null;
  title: string;
  slug: string;
  description: string;
  status: EventStatus;
  visibility: EventVisibility;
  startsAt: Date;
  endsAt: Date;
  timezone: string;
  locationName: string | null;
  locationAddress: string | null;
  onlineUrl: string | null;
  /** null = places illimitées. */
  capacity: number | null;
  priceCents: number;
  currency: string;
  paymentMode: PaymentMode;
  depositPercent: number | null;
  requiresApproval: boolean;
  highlights: string[];
  /** Lien de paiement externe propre à l'événement (sinon celui de l'espace). */
  paymentLinkUrl: string | null;
  coverImageUrl: string | null;
  publishedAt: Date | null;
  cancelledAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

/** Champs modifiables d'un événement (le reste est géré par les cas d'usage). */
export type EventDetails = Pick<
  Event,
  | "title"
  | "description"
  | "visibility"
  | "startsAt"
  | "endsAt"
  | "timezone"
  | "locationName"
  | "locationAddress"
  | "onlineUrl"
  | "capacity"
  | "priceCents"
  | "paymentMode"
  | "depositPercent"
  | "requiresApproval"
  | "highlights"
  | "paymentLinkUrl"
>;
