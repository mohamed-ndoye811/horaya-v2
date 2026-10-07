import { z } from "zod";

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

export const participantSchema = z.object({
  firstName: z.string().trim().min(1).max(60),
  lastName: z.string().trim().min(1).max(60),
  email: z
    .email()
    .trim()
    .toLowerCase()
    .nullish()
    .transform((value) => value ?? null),
  customAnswers: z.record(z.string(), z.union([z.string().max(500), z.boolean()])).default({}),
});

export const createEventBookingSchema = z
  .object({
    eventId: z.uuid(),
    seats: z.int().min(1, "Au moins une place").max(1000),
    customer: customerContactSchema,
    participants: z.array(participantSchema).max(1000).default([]),
    customerMessage: optionalText(1000),
  })
  .refine((input) => input.participants.length <= input.seats, {
    message: "Plus de participants que de places",
    path: ["participants"],
  });
export type CreateEventBookingInput = z.input<typeof createEventBookingSchema>;
