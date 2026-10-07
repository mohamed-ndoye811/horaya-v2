import { z } from "zod";

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .nullish()
    .transform((value) => value || null);

const money = (label: string) =>
  z
    .int({ error: `${label} invalide` })
    .min(0)
    .max(100_000_000)
    .nullable();

const itemFields = {
  name: z.string().trim().min(2, "2 caractères minimum").max(120),
  /** Référence interne (« VP-014 ») ; générée si vide. */
  reference: z
    .string()
    .trim()
    .toUpperCase()
    .max(30)
    .regex(/^[A-Z0-9-]*$/, "Lettres, chiffres et tirets uniquement"),
  typeName: optionalText(60),
  description: optionalText(2000),
  dailyRateCents: money("Tarif"),
  depositCents: money("Caution"),
  storageLocation: optionalText(120),
  purchasedOn: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Date invalide")
    .nullish()
    .transform((value) => value || null),
  purchasePriceCents: money("Prix d'achat"),
  rentable: z.boolean(),
};

export const createItemSchema = z.object({
  ...itemFields,
  reference: itemFields.reference.default(""),
  typeName: itemFields.typeName.default(null),
  dailyRateCents: itemFields.dailyRateCents.default(null),
  depositCents: itemFields.depositCents.default(null),
  purchasePriceCents: itemFields.purchasePriceCents.default(null),
  rentable: itemFields.rentable.default(false),
  quantity: z
    .int({ error: "Quantité invalide" })
    .min(1, "Au moins un exemplaire")
    .max(500, "500 exemplaires maximum"),
});
export type CreateItemInput = z.input<typeof createItemSchema>;

/** Mise à jour partielle (pas de valeur par défaut, cf. Zod 4) ; la quantité se règle à part. */
export const updateItemSchema = z.object(itemFields).partial();
export type UpdateItemInput = z.input<typeof updateItemSchema>;

const periodShape = {
  startsAt: z.coerce.date({ error: "Date ou heure invalide" }),
  endsAt: z.coerce.date({ error: "Date ou heure invalide" }),
};

export const maintenanceSchema = z.object({
  itemId: z.uuid(),
  /** Exemplaires concernés (au moins un). */
  unitIds: z.array(z.uuid()).min(1, "Choisis au moins un exemplaire"),
  ...periodShape,
  title: z.string().trim().min(2, "Décris l'intervention").max(120),
  provider: optionalText(120),
  costCents: money("Coût").default(null),
  note: optionalText(1000),
});
export type MaintenanceInput = z.input<typeof maintenanceSchema>;

export const eventItemSchema = z.object({
  eventId: z.uuid(),
  itemId: z.uuid(),
  quantity: z.int({ error: "Quantité invalide" }).min(1, "Au moins un exemplaire").max(500),
});
export type EventItemInput = z.input<typeof eventItemSchema>;
