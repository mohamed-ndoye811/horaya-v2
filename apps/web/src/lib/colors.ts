/**
 * Couleurs de catégorie (types d'événements, avatars) : texte clair sur les teintes
 * foncées, et sur les teintes claires une version très sombre de la même couleur
 * (comme les maquettes : jaune → #2A2410, rose → #3A1622).
 */
export const CATEGORY_COLORS = ["#528D74", "#D8BC66", "#CF879C", "#66537C", "#264489"] as const;

function channels(hex: string): [number, number, number] {
  const value = Number.parseInt(hex.replace("#", ""), 16);
  return [(value >> 16) & 255, (value >> 8) & 255, value & 255];
}

/** Luminance relative WCAG (0 = noir, 1 = blanc). */
export function luminance(hex: string): number {
  const [r, g, b] = channels(hex).map((channel) => {
    const c = channel / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  }) as [number, number, number];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** Couleur de texte lisible sur un fond de catégorie. */
export function textOn(hex: string): string {
  if (luminance(hex) < 0.3) return "#F7F5F3";
  const [r, g, b] = channels(hex).map((channel) => Math.round(channel * 0.2));
  return `#${[r, g, b]
    .map((channel) => channel.toString(16).padStart(2, "0"))
    .join("")
    .toUpperCase()}`;
}

/** Couleur stable dérivée d'un texte (avatars des clients). */
export function colorFor(seed: string): string {
  let hash = 0;
  for (const char of seed) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return CATEGORY_COLORS[hash % CATEGORY_COLORS.length] ?? CATEGORY_COLORS[0];
}
