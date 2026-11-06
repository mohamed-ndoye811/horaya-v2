const NUMBER = /^(\D*?)(\d(?:[\d\s  ]*\d)?)(\D.*)?$/;

/**
 * Découpe un chiffre clé en texte avant / nombre entier / texte après (« 1 240 € »).
 * `null` si rien à faire défiler : pas de nombre, zéro, ou une décimale (« 12,5 »).
 */
export function splitCount(
  value: string,
): { before: string; target: number; after: string } | null {
  const match = value.match(NUMBER);
  if (!match) return null;
  const [, before = "", digits = "", after = ""] = match;
  const target = Number(digits.replace(/\D/g, ""));
  if (target === 0 || after.startsWith(",")) return null;
  return { before, target, after };
}
