import type { EventTypeField, FieldValues } from "../fields/model";
import type { EventStatus, EventVisibility, PaymentMode } from "./types";

/**
 * Nom des réservations d'un type, sur la page publique et le bouton du formulaire :
 * « 3 inscriptions », « Je m'inscris ».
 */
export const BOOKING_NOUNS = ["reservation", "inscription", "location", "demande"] as const;
export type BookingNoun = (typeof BOOKING_NOUNS)[number];

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
  /** « Ce que tu décris » et « Ce que tu demandes ». */
  fields: EventTypeField[];
  bookingNoun: BookingNoun;
  bookingRules: BookingRules;
  archivedAt: Date | null;
}

/**
 * Série d'événements (événement récurrent). Chaque occurrence reste un vrai `Event` ;
 * la série porte la règle et, pour les cours à l'année, l'inscription à toute la série.
 */
export interface EventSeries {
  id: string;
  organizationId: string;
  rrule: string;
  until: Date | null;
  timezone: string;
  /** « Inscription à la série » : une place dans chaque séance restante, un seul paiement. */
  enrollmentEnabled: boolean;
  /** Prix de l'inscription à toute la série (ex. le trimestre), en centimes. */
  enrollmentPriceCents: number | null;
  /** La réservation à la séance reste possible sur la page publique. */
  dropInAllowed: boolean;
  /** Inscription en cours de route : prix de la série × séances restantes ÷ séances totales. */
  enrollmentProrata: boolean;
  /** Une absence signalée à temps donne une séance à rattraper avant la fin de la série. */
  makeupAllowed: boolean;
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
  /**
   * Champs du type copiés à la création : l'événement garde sa version même si le type
   * change ensuite (sauf « Appliquer aussi aux événements à venir », sans inscription).
   */
  fields: EventTypeField[];
  /** Valeurs de « Ce que tu décris ». */
  fieldValues: FieldValues;
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
