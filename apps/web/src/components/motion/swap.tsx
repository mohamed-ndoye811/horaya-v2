"use client";

import { type ReactNode, useState } from "react";

/**
 * Contenu qui change d'état (« Je serai absent·e » → « Absence signalée ») : le nouveau arrive
 * en fondu léger. Rien au premier affichage, seulement quand `value` change.
 */
export function Swap({
  value,
  children,
  block = false,
  slide,
}: {
  value: string;
  children: ReactNode;
  /** Bloc entier (formulaire, carte) : fondu seul, sans l'échelle des pastilles. */
  block?: boolean;
  /**
   * Texte qui change de période : 1 il arrive de la droite (suivant), -1 de la gauche
   * (précédent), 0 en fondu (autre vue).
   */
  slide?: number;
}) {
  const base = block ? "block" : slide !== undefined ? "inline-block" : "";
  const animation =
    slide === undefined
      ? block
        ? "animate-fade"
        : "animate-pop"
      : slide > 0
        ? "animate-text-next"
        : slide < 0
          ? "animate-text-prev"
          : "animate-fade";
  const [seen, setSeen] = useState({ value, changed: false });
  if (seen.value !== value) setSeen({ value, changed: true });
  return (
    <span key={value} className={seen.changed ? `${base} ${animation}` : base}>
      {children}
    </span>
  );
}
