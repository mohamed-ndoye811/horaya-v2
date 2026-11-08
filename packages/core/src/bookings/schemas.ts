import { z } from "zod";
import { rawFieldValuesSchema } from "../fields/schemas";
import { equipmentChoiceSchema } from "../modules/registry";

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .nullish()
    .transform((value) => value || null);

export const customerContactSchema = z.object({
  firstName: z.string().trim().min(1, "Prénom requis").max(60),
  lastName: z.string().trim().min(1, "Nom requis").max(60),
  email: z.email("Adresse e-mail invalide").trim().toLowerCase(),
  phone: optionalText(30),
  company: optionalText(120),
});

/** Participant d'une place : nom facultatif, réponses validées contre les champs de l'événement. */
export const participantSchema = z.object({
  firstName: z.string().trim().max(60).default(""),
  lastName: z.string().trim().max(60).default(""),
  email: z
    .email()
    .trim()
    .toLowerCase()
    .nullish()
    .transform((value) => value ?? null),
  answers: rawFieldValuesSchema.default({}),
});

/** Choix du prix (lot 35), vérifié par `quoteBooking` contre les tarifs de l'événement. */
export const priceRatesSchema = z.array(z.string().max(40)).max(1000).default([]);
export const priceOptionsSchema = z
  .record(z.string().max(40), z.int().min(0).max(100_000))
  .default({});

export const createEventBookingSchema = z
  .object({
    /** L'événement ; ou `holdId`, le créneau gardé (module Créneaux, lot 37). */
    eventId: z.uuid().optional(),
    holdId: z.uuid().optional(),
    seats: z.int().min(1, "Au moins une place").max(1000),
    customer: customerContactSchema,
    /** Réponses aux questions « une fois par inscription ». */
    answers: rawFieldValuesSchema.default({}),
    participants: z.array(participantSchema).max(1000).default([]),
    customerMessage: optionalText(1000),
    /** Lien calendrier par lequel le client est arrivé (vaut invitation). */
    calendarLinkSlug: optionalText(120),
    /** Tarif de chaque place (dans l'ordre des participants) ; absent : le tarif par défaut. */
    rates: priceRatesSchema,
    /** Quantité de chaque option choisie. */
    options: priceOptionsSchema,
    /** Bon cadeau à déduire du prix. */
    giftCardCode: optionalText(40),
    /** Module Matériel avancé : cases cochées et exemplaires choisis. */
    equipment: z.array(equipmentChoiceSchema).max(10).default([]),
  })
  .refine((input) => (input.eventId === undefined) !== (input.holdId === undefined), {
    message: "Choisis un événement ou un créneau",
    path: ["eventId"],
  })
  .refine((input) => input.participants.length <= input.seats, {
    message: "Plus de participants que de places",
    path: ["participants"],
  })
  .refine((input) => input.rates.length <= input.seats, {
    message: "Plus de tarifs que de places",
    path: ["rates"],
  });
export type CreateEventBookingInput = z.input<typeof createEventBookingSchema>;
