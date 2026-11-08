import { z } from "zod";

/** Réglage « Inscription à la série » d'une série d'événements. */
export const seriesEnrollmentSettingsSchema = z
  .object({
    enrollmentEnabled: z.boolean(),
    enrollmentPriceCents: z
      .int({ error: "Prix invalide" })
      .min(0)
      .max(10_000_000, "Prix trop élevé")
      .nullable(),
    dropInAllowed: z.boolean(),
    enrollmentProrata: z.boolean(),
    makeupAllowed: z.boolean(),
  })
  .superRefine((input, context) => {
    if (input.enrollmentEnabled && input.enrollmentPriceCents === null) {
      context.addIssue({
        code: "custom",
        path: ["enrollmentPriceCents"],
        message: "Indique le prix de la série",
      });
    }
  });
export type SeriesEnrollmentSettingsInput = z.input<typeof seriesEnrollmentSettingsSchema>;
