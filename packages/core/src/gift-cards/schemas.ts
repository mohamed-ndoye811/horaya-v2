import { z } from "zod";
import type { GiftCardSettings } from "./model";

export const DEFAULT_GIFT_CARD_SETTINGS: GiftCardSettings = {
  enabled: false,
  amountsCents: [3000, 5000, 10000],
  customAmount: false,
  minCents: 2000,
  maxCents: 30000,
  validityMonths: 12,
  message: null,
};

const cents = z.int({ error: "Montant invalide" }).min(100, "1 € minimum").max(1_000_000);

export const giftCardSettingsSchema = z
  .object({
    enabled: z.boolean(),
    amountsCents: z.array(cents).max(12, "12 montants maximum"),
    customAmount: z.boolean(),
    minCents: cents,
    maxCents: cents,
    validityMonths: z.int({ error: "Durée invalide" }).min(1).max(60, "60 mois maximum"),
    message: z
      .string()
      .trim()
      .max(500, "500 caractères maximum")
      .nullish()
      .transform((value) => value || null),
  })
  .superRefine((settings, context) => {
    if (settings.minCents > settings.maxCents) {
      context.addIssue({
        code: "custom",
        path: ["maxCents"],
        message: "Maximum inférieur au minimum",
      });
    }
    if (settings.enabled && settings.amountsCents.length === 0 && !settings.customAmount) {
      context.addIssue({
        code: "custom",
        path: ["amountsCents"],
        message: "Propose au moins un montant, ou autorise un montant libre",
      });
    }
  })
  .transform((settings) => ({
    ...settings,
    amountsCents: [...new Set(settings.amountsCents)].sort((a, b) => a - b),
  }));
export type GiftCardSettingsInput = z.input<typeof giftCardSettingsSchema>;

const name = (label: string) => z.string().trim().min(1, `${label} requis`).max(120);
const email = z.email("Adresse e-mail invalide").trim().toLowerCase();

export const purchaseGiftCardSchema = z.object({
  amountCents: cents,
  purchaserName: name("Ton nom"),
  purchaserEmail: email,
  recipientName: name("Nom du bénéficiaire"),
  recipientEmail: z.preprocess(
    (value) => (typeof value === "string" && value.trim() === "" ? null : value),
    email.nullish().transform((value) => value ?? null),
  ),
  message: z
    .string()
    .trim()
    .max(500, "500 caractères maximum")
    .nullish()
    .transform((value) => value || null),
  /** Vente par l'équipe (comptoir) : déjà encaissée, le bon est actif tout de suite. */
  paid: z.boolean().default(false),
});
export type PurchaseGiftCardInput = z.input<typeof purchaseGiftCardSchema>;
