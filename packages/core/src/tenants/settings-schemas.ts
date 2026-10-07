import { z } from "zod";
import { paymentLinkSchema } from "../shared/links";
import { hexColorSchema } from "./workspace";

/** Police des titres de la page publique (écran 24). */
export const DISPLAY_FONTS = [
  { value: "display", label: "Archivo", tone: "éditorial" },
  { value: "ui", label: "Urbanist", tone: "moderne" },
  { value: "mono", label: "Geist Mono", tone: "technique" },
] as const;
export type DisplayFont = (typeof DISPLAY_FONTS)[number]["value"];

/** Délais d'annulation gratuite proposés (en heures ; 0 = pas d'annulation gratuite). */
export const FREE_CANCELLATION_HOURS = [0, 24, 48, 72, 168] as const;

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `${max} caractères maximum`)
    .nullish()
    .transform((value) => value || null);

const percent = (label: string) =>
  z
    .int({ error: `${label} invalide` })
    .min(0, `${label} : 0 % minimum`)
    .max(100, `${label} : 100 % maximum`);

/** Champs modifiables dans les paramètres. Pas de valeur par défaut : mise à jour partielle. */
export const updateTenantSettingsSchema = z
  .object({
    brandColor: hexColorSchema,
    displayFont: z.enum(DISPLAY_FONTS.map((font) => font.value) as [DisplayFont, ...DisplayFont[]]),
    description: z
      .string()
      .trim()
      .max(280, "280 caractères maximum")
      .nullish()
      .transform((value) => value || null),
    /** Coordonnées et identité légale, affichées sur la page publique. */
    contactEmail: z
      .string()
      .trim()
      .toLowerCase()
      .pipe(z.union([z.literal(""), z.email("Adresse e-mail invalide")]))
      .nullish()
      .transform((value) => value || null),
    contactPhone: optionalText(30),
    address: optionalText(300),
    legalName: optionalText(120),
    siret: z
      .string()
      .transform((value) => value.replace(/\s/g, ""))
      .pipe(z.union([z.literal(""), z.string().regex(/^\d{14}$/, "Le SIRET compte 14 chiffres")]))
      .nullish()
      .transform((value) => value || null),
    /** TVA en points de base : 2000 = 20 %. */
    vatRateBps: z.int({ error: "TVA invalide" }).min(0, "TVA invalide").max(10_000, "TVA invalide"),
    defaultDepositPercent: percent("Acompte").min(1, "Acompte : 1 % minimum"),
    freeCancellationHours: z
      .int({ error: "Délai invalide" })
      .min(0)
      .max(24 * 30, "30 jours maximum"),
    lateCancellationRefundPercent: percent("Remboursement"),
    /** Lien de paiement par défaut de l'espace (paiement hors Horaya). */
    paymentLinkUrl: paymentLinkSchema,
  })
  .partial();
export type UpdateTenantSettingsInput = z.input<typeof updateTenantSettingsSchema>;
export type TenantSettingsPatch = z.output<typeof updateTenantSettingsSchema>;
