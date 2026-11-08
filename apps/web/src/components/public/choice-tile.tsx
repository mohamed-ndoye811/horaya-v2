import { cn } from "@/lib/cn";

/**
 * Tuile de choix des pages publiques (durée, jour, heure, intervenant, tarif) : choisie, elle
 * est pleine, de la couleur de l'atelier (noire sans couleur), texte blanc ; sinon fond
 * `#F6F6F4` bordé de `#EDEDEB`. Tous les choix de même nature ont cette forme.
 */
export const choiceTileClasses = (selected: boolean) =>
  cn(
    "press rounded-xl transition-colors",
    selected
      ? "border-[1.5px] border-[var(--brand,var(--color-ink))] bg-[var(--brand,var(--color-ink))] text-[var(--on-brand,#ffffff)]"
      : "border border-[#EDEDEB] bg-[#F6F6F4] text-ink hover:border-line-strong",
  );

/** Texte secondaire d'une tuile (description, jour de la semaine). */
export const choiceTileMutedClasses = (selected: boolean) =>
  selected ? "text-[color-mix(in_srgb,var(--on-brand,#ffffff)_80%,transparent)]" : "text-ink-muted";
