import { z } from "zod";
import { isValidTimeZone } from "../shared/time";
import { recurrenceSchema } from "./recurrence";
import { EVENT_VISIBILITIES, PAYMENT_MODES } from "./types";

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .nullish()
    .transform((value) => value || null);

const customFieldSchema = z.object({
  key: z.string().regex(/^[a-z][a-z0-9_]{0,39}$/, "Clé en minuscules, chiffres et _"),
  label: z.string().trim().min(1).max(80),
  type: z.enum(["text", "select", "checkbox"]),
  required: z.boolean(),
  options: z.array(z.string().trim().min(1).max(80)).max(20).optional(),
});

export const createEventTypeSchema = z.object({
  name: z.string().trim().min(2).max(60),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/, "Couleur hexadécimale attendue (#RRGGBB)"),
  description: optionalText(500),
  defaultDurationMinutes: z
    .int()
    .min(5)
    .max(60 * 24 * 14)
    .nullish()
    .default(null),
  defaultPriceCents: z.int().min(0).max(10_000_000).nullish().default(null),
  defaultCapacity: z.int().min(1).max(100_000).nullish().default(null),
  requiresApproval: z.boolean().default(false),
  customFields: z.array(customFieldSchema).max(15).default([]),
  bookingRules: z
    .object({
      minAdvanceHours: z
        .int()
        .min(0)
        .max(24 * 90)
        .optional(),
      maxSeatsPerBooking: z.int().min(1).max(1000).optional(),
      waitlistEnabled: z.boolean().optional(),
    })
    .default({}),
});
export type CreateEventTypeInput = z.input<typeof createEventTypeSchema>;

/**
 * Champs d'un événement, sans valeur par défaut : Zod 4 applique les `.default()` même
 * aux clés absentes, ce qui écraserait les valeurs existantes lors d'une mise à jour partielle.
 */
const eventFields = {
  title: z.string().trim().min(2, "2 caractères minimum").max(120),
  description: z.string().trim().max(5000),
  visibility: z.enum(EVENT_VISIBILITIES),
  startsAt: z.coerce.date(),
  endsAt: z.coerce.date(),
  timezone: z.string().refine(isValidTimeZone, "Fuseau horaire inconnu"),
  locationName: optionalText(200),
  locationAddress: optionalText(300),
  onlineUrl: z
    .url()
    .nullish()
    .transform((value) => value ?? null),
  capacity: z.int().min(1).max(100_000).nullable(),
  priceCents: z.int().min(0).max(10_000_000),
  paymentMode: z.enum(PAYMENT_MODES),
  depositPercent: z.int().min(1).max(99).nullable(),
  requiresApproval: z.boolean(),
  highlights: z.array(z.string().trim().min(1).max(80)).max(6),
};

export const createEventSchema = z.object({
  eventTypeId: z.uuid(),
  ...eventFields,
  description: eventFields.description.default(""),
  visibility: eventFields.visibility.default("public"),
  capacity: eventFields.capacity.default(null),
  priceCents: eventFields.priceCents.default(0),
  paymentMode: eventFields.paymentMode.default("free"),
  depositPercent: eventFields.depositPercent.default(null),
  /** Par défaut, celui du type d'événement. */
  requiresApproval: eventFields.requiresApproval.optional(),
  highlights: eventFields.highlights.default([]),
  recurrence: recurrenceSchema.optional(),
});
export type CreateEventInput = z.input<typeof createEventSchema>;

/** Mise à jour partielle : la cohérence est revérifiée sur l'événement fusionné. */
export const updateEventSchema = z.object(eventFields).partial();
export type UpdateEventInput = z.input<typeof updateEventSchema>;
