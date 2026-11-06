import type { CSSProperties } from "react";

/* Grain : bruit SVG en niveaux de gris, fondu en « soft-light » sur les couleurs. */
const GRAIN =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='180' height='180'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.85' numOctaves='3' stitchTiles='stitch'/%3E%3CfeColorMatrix type='saturate' values='0'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")";

/* Quatre compositions (tache claire, tache vive, tache décalée), choisies d'après l'événement. */
const LAYOUTS = [
  ["15% 20%", "60% 55%", "95% 5%"],
  ["50% 110%", "15% 70%", "90% 45%"],
  ["85% 100%", "40% 65%", "5% 15%"],
  ["5% 105%", "55% 40%", "100% 75%"],
] as const;

export function seedOf(value: string): number {
  let hash = 0;
  for (const char of value) hash = (hash * 31 + char.charCodeAt(0)) | 0;
  return Math.abs(hash);
}

/**
 * Visuel d'un événement sans photo : un fond profond tiré de la couleur, trois taches de lumière
 * floues (claire, vive, teinte décalée) et du grain. `color` peut être une variable CSS.
 */
export function meshCover(color: string, seed: string): CSSProperties {
  const n = seedOf(seed);
  const [light, vivid, shifted] = LAYOUTS[n % LAYOUTS.length] ?? LAYOUTS[0];
  const turn = n % 2 ? 40 : -40;
  return {
    backgroundColor: `oklch(from ${color} 0.2 calc(c * 0.5) h)`,
    backgroundImage: [
      GRAIN,
      `radial-gradient(circle at ${light}, oklch(from ${color} 0.9 0.07 calc(h - 25)) 0%, transparent 48%)`,
      `radial-gradient(circle at ${vivid}, oklch(from ${color} 0.62 calc(c + 0.06) h) 0%, transparent 62%)`,
      `radial-gradient(circle at ${shifted}, oklch(from ${color} 0.48 calc(c + 0.04) calc(h + ${turn})) 0%, transparent 55%)`,
    ].join(", "),
    backgroundBlendMode: "soft-light, normal, normal, normal",
    backgroundSize: "180px 180px, cover, cover, cover",
    backgroundPosition: "0 0, center, center, center",
  };
}
