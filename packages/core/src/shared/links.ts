import { z } from "zod";

/** Lien de paiement externe (Stripe, SumUp, PayPal, HelloAsso…) : https uniquement. */
export const paymentLinkSchema = z
  .string()
  .trim()
  .max(500, "Lien trop long")
  .nullish()
  .transform((value) => value || null)
  .refine((value) => value === null || /^https:\/\/[^\s]+\.[^\s]+$/.test(value), {
    message: "Lien de paiement invalide (il doit commencer par https://)",
  });
