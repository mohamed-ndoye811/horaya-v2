import { z } from "zod";
import { PAYMENT_METHODS } from "../bookings/types";

export const passPlanSchema = z.object({
  name: z.string().trim().min(1, "Nom requis").max(80),
  sessions: z.int("Nombre entier").min(1, "Au moins une séance").max(200),
  priceCents: z.int("Prix invalide").min(0, "Prix invalide").max(10_000_000),
  validityDays: z.int("Nombre entier").min(1, "Au moins un jour").max(3650),
  /** Vide = tous les types d'événements. */
  eventTypeIds: z.array(z.uuid()).max(100).default([]),
});
export type PassPlanInput = z.input<typeof passPlanSchema>;

export const sellPassSchema = z.object({
  customerId: z.uuid(),
  planId: z.uuid(),
  /** Déjà payée : la carte est active tout de suite. */
  paid: z.boolean().default(false),
  paymentMethod: z.enum(PAYMENT_METHODS).nullish(),
});
export type SellPassInput = z.input<typeof sellPassSchema>;

export const adjustPassSchema = z.object({
  delta: z
    .int("Nombre entier")
    .min(-200)
    .max(200)
    .refine((value) => value !== 0, "Indique un nombre de séances"),
  reason: z.string().trim().min(3, "Explique l'ajustement").max(300),
});
export type AdjustPassInput = z.input<typeof adjustPassSchema>;

export const payWithPassSchema = z.object({ bookingId: z.uuid(), passId: z.uuid() });
export type PayWithPassInput = z.input<typeof payWithPassSchema>;
