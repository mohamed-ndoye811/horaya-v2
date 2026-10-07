import { z } from "zod";

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .nullish()
    .transform((value) => value || null);

/** Étiquettes libres, en minuscules, sans doublon (« vip », « entreprise »…). */
const tagsSchema = z
  .array(z.string().trim().toLowerCase().min(1).max(30))
  .max(12)
  .transform((tags) => [...new Set(tags)]);

const customerFields = {
  firstName: z.string().trim().min(1, "Prénom requis").max(60),
  lastName: z.string().trim().min(1, "Nom requis").max(60),
  email: z.email("Adresse e-mail invalide").trim().toLowerCase(),
  phone: optionalText(30),
  company: optionalText(120),
  tags: tagsSchema,
  marketingConsent: z.boolean(),
};

export const createCustomerSchema = z.object({
  ...customerFields,
  tags: tagsSchema.default([]),
  marketingConsent: customerFields.marketingConsent.default(false),
});
export type CreateCustomerInput = z.input<typeof createCustomerSchema>;

/** Mise à jour partielle : pas de valeur par défaut (cf. Zod 4). */
export const updateCustomerSchema = z.object(customerFields).partial();
export type UpdateCustomerInput = z.input<typeof updateCustomerSchema>;

export const customerNoteSchema = z.object({
  body: z.string().trim().min(1, "La note est vide").max(2000, "2 000 caractères maximum"),
  pinned: z.boolean().default(false),
});
export type CustomerNoteInput = z.input<typeof customerNoteSchema>;
