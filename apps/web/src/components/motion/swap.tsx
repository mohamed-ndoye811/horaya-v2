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
}: {
  value: string;
  children: ReactNode;
  /** Bloc entier (formulaire, carte) : fondu seul, sans l'échelle des pastilles. */
  block?: boolean;
}) {
  const base = block ? "block" : "";
  const animation = block ? "animate-fade" : "animate-pop";
  const [seen, setSeen] = useState({ value, changed: false });
  if (seen.value !== value) setSeen({ value, changed: true });
  return (
    <span key={value} className={seen.changed ? `${base} ${animation}` : base}>
      {children}
    </span>
  );
}
