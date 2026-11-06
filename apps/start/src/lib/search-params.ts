import { z } from "zod";

/** Lit un paramètre d'URL simple (ignore les valeurs multiples). */
export function param(value: string | string[] | undefined): string | undefined {
  return typeof value === "string" && value !== "" ? value : undefined;
}

/** Construit une URL en gardant les paramètres utiles. */
export function withParams(path: string, params: Record<string, string | undefined>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) if (value) search.set(key, value);
  const query = search.toString();
  return query ? `${path}?${query}` : path;
}

/**
 * Paramètre d'URL texte, pour `validateSearch` : une valeur vide, absente ou illisible
 * (tableau, objet) est ignorée.
 */
export const searchText = z
  .preprocess(
    (value) => (value === "" || value == null ? undefined : String(value)),
    z.string().max(200),
  )
  .optional()
  .catch(undefined);
