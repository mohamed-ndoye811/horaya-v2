import { z } from "zod";
import { eventTypeFieldsSchema, rawFieldValuesSchema } from "../fields/schemas";
import { depositModuleSchema, eventTypeModulesSchema } from "../modules/registry";
import { paymentLinkSchema } from "../shared/links";
import { isValidTimeZone } from "../shared/time";
import { BOOKING_NOUNS } from "./model";
import { recurrenceSchema } from "./recurrence";
import { EVENT_VISIBILITIES, PAYMENT_MODES } from "./types";

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .nullish()
    .transform((value) => value || null);

/** Champs d'un type d'événement, sans valeur par défaut (cf. mise à jour partielle). */
const eventTypeFields = {
  name: z.string().trim().min(2, "2 caractères minimum").max(60),
  color: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/, "Couleur hexadécimale attendue (#RRGGBB)")
    .transform((color) => color.toUpperCase()),
  description: optionalText(500),
  defaultDurationMinutes: z
    .int()
    .min(5)
    .max(60 * 24 * 14)
    .nullable(),
  defaultPriceCents: z.int().min(0).max(10_000_000).nullable(),
  modules: eventTypeModulesSchema,
  fields: eventTypeFieldsSchema,
  bookingNoun: z.enum(BOOKING_NOUNS),
};

export const createEventTypeSchema = z.object({
  ...eventTypeFields,
  defaultDurationMinutes: eventTypeFields.defaultDurationMinutes.optional().default(null),
  defaultPriceCents: eventTypeFields.defaultPriceCents.optional().default(null),
  modules: eventTypeFields.modules.default({}),
  fields: eventTypeFields.fields.default([]),
  bookingNoun: eventTypeFields.bookingNoun.default("reservation"),
});
export type CreateEventTypeInput = z.input<typeof createEventTypeSchema>;

export const updateEventTypeSchema = z.object({
  ...z.object(eventTypeFields).partial().shape,
  /** Champs et modules aussi sur les événements à venir sans inscription (sinon : les prochains). */
  applyToUpcoming: z.boolean().optional(),
});
export type UpdateEventTypeInput = z.input<typeof updateEventTypeSchema>;

/**
 * Champs d'un événement, sans valeur par défaut : Zod 4 applique les `.default()` même
 * aux clés absentes, ce qui écraserait les valeurs existantes lors d'une mise à jour partielle.
 */
const eventFields = {
  title: z.string().trim().min(2, "2 caractères minimum").max(120),
  description: z.string().trim().max(5000),
  visibility: z.enum(EVENT_VISIBILITIES),
  startsAt: z.coerce.date({ error: "Date ou heure invalide" }),
  endsAt: z.coerce.date({ error: "Date ou heure invalide" }),
  timezone: z.string().refine(isValidTimeZone, "Fuseau horaire inconnu"),
  locationName: optionalText(200),
  locationAddress: optionalText(300),
  onlineUrl: z
    .url()
    .nullish()
    .transform((value) => value ?? null),
  capacity: z
    .int({ error: "Nombre de places invalide" })
    .min(1, "Au moins une place")
    .max(100_000)
    .nullable(),
  priceCents: z.int({ error: "Prix invalide" }).min(0).max(10_000_000, "Prix trop élevé"),
  paymentMode: z.enum(PAYMENT_MODES),
  /** Acompte de l'événement (module « Acompte ») ; null : pas d'acompte. */
  deposit: depositModuleSchema.nullable(),
  /** Prix des tarifs et options de l'événement, par identifiant (les noms restent ceux du type). */
  prices: z.record(
    z.string().max(40),
    z.int({ error: "Prix invalide" }).min(0).max(10_000_000, "Prix trop élevé"),
  ),
  requiresApproval: z.boolean(),
  highlights: z.array(z.string().trim().min(1).max(80)).max(6),
  paymentLinkUrl: paymentLinkSchema,
  /** Module Intervenant : membre de l'équipe qui anime l'événement. */
  staffMemberId: z.uuid().nullable(),
  /** Module Matériel avancé : exemplaires proposés sur cet événement, besoin par besoin. */
  equipmentUnits: z.record(z.string(), z.array(z.uuid()).max(500)),
  /** « Ce que tu décris », validé contre les champs de l'événement par le cas d'usage. */
  fieldValues: rawFieldValuesSchema,
};

export const createEventSchema = z.object({
  eventTypeId: z.uuid(),
  ...eventFields,
  description: eventFields.description.default(""),
  visibility: eventFields.visibility.default("public"),
  capacity: eventFields.capacity.default(null),
  priceCents: eventFields.priceCents.default(0),
  paymentMode: eventFields.paymentMode.default("free"),
  /** Absent : celui du type. */
  deposit: eventFields.deposit.optional(),
  prices: eventFields.prices.optional(),
  /** Par défaut, celui du type d'événement. */
  requiresApproval: eventFields.requiresApproval.optional(),
  highlights: eventFields.highlights.default([]),
  paymentLinkUrl: eventFields.paymentLinkUrl.default(null),
  fieldValues: eventFields.fieldValues.default({}),
  staffMemberId: eventFields.staffMemberId.default(null),
  equipmentUnits: eventFields.equipmentUnits.optional(),
  recurrence: recurrenceSchema.optional(),
});
export type CreateEventInput = z.input<typeof createEventSchema>;

/** Mise à jour partielle : la cohérence est revérifiée sur l'événement fusionné. */
export const updateEventSchema = z.object(eventFields).partial();
export type UpdateEventInput = z.input<typeof updateEventSchema>;
