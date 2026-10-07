import { z } from "zod";

/**
 * Adresses réservées : chemins de l'application qui ne doivent jamais
 * pouvoir être pris par une page publique (horaya.app/<slug>).
 */
export const RESERVED_SLUGS: ReadonlySet<string> = new Set([
  "admin",
  "aide",
  "api",
  "app",
  "assets",
  "blog",
  "cgu",
  "compte",
  "confidentialite",
  "connexion",
  "contact",
  "docs",
  "horaya",
  "inscription",
  "invitation",
  "legal",
  "mentions-legales",
  "mot-de-passe-oublie",
  "nouveau-mot-de-passe",
  "paiement-test",
  "parametres",
  "public",
  "static",
  "status",
  "support",
  "tarifs",
  "www",
]);

export const SLUG_MIN_LENGTH = 3;
export const SLUG_MAX_LENGTH = 48;

/** « Cabinet Vidal & Fils » → « cabinet-vidal-fils ». */
export function slugify(value: string): string {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, SLUG_MAX_LENGTH)
    .replace(/-+$/, "");
}

export const slugSchema = z
  .string()
  .trim()
  .min(SLUG_MIN_LENGTH, `${SLUG_MIN_LENGTH} caractères minimum`)
  .max(SLUG_MAX_LENGTH, `${SLUG_MAX_LENGTH} caractères maximum`)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Lettres minuscules, chiffres et tirets uniquement")
  .refine((slug) => !RESERVED_SLUGS.has(slug), "Cette adresse est réservée");

export const TENANT_SECTORS = [
  { value: "consulting", label: "Conseil & formation" },
  { value: "events", label: "Événementiel" },
  { value: "culture", label: "Culture & loisirs" },
  { value: "wellness", label: "Sport & bien-être" },
  { value: "education", label: "Enseignement" },
  { value: "hospitality", label: "Tourisme & hôtellerie" },
  { value: "association", label: "Association" },
  { value: "other", label: "Autre" },
] as const;
export type TenantSector = (typeof TENANT_SECTORS)[number]["value"];

/** Couleurs proposées à la création ; toute couleur hexadécimale reste acceptée. */
export const BRAND_COLOR_PRESETS = ["#264489", "#528D74", "#CF879C", "#66537C", "#1F1F1F"] as const;

export const hexColorSchema = z
  .string()
  .regex(/^#[0-9a-fA-F]{6}$/, "Couleur hexadécimale attendue (#RRGGBB)")
  .transform((color) => color.toUpperCase());

export const createWorkspaceSchema = z.object({
  name: z.string().trim().min(2, "2 caractères minimum").max(80, "80 caractères maximum"),
  slug: slugSchema,
  sector: z.enum(TENANT_SECTORS.map((sector) => sector.value) as [TenantSector, ...TenantSector[]]),
  brandColor: hexColorSchema,
});
export type CreateWorkspaceInput = z.infer<typeof createWorkspaceSchema>;
