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

export const createEventBookingSchema = z
  .object({
    eventId: z.uuid(),
    seats: z.int().min(1, "Au moins une place").max(1000),
    customer: customerContactSchema,
    /** Réponses aux questions « une fois par inscription ». */
    answers: rawFieldValuesSchema.default({}),
    participants: z.array(participantSchema).max(1000).default([]),
    customerMessage: optionalText(1000),
    /** Lien calendrier par lequel le client est arrivé (vaut invitation). */
    calendarLinkSlug: optionalText(120),
    /** Bon cadeau à déduire du prix. */
    giftCardCode: optionalText(40),
    /** Module Matériel avancé : cases cochées et exemplaires choisis. */
    equipment: z.array(equipmentChoiceSchema).max(10).default([]),
  })
  .refine((input) => input.participants.length <= input.seats, {
    message: "Plus de participants que de places",
    path: ["participants"],
  });
export type CreateEventBookingInput = z.input<typeof createEventBookingSchema>;
