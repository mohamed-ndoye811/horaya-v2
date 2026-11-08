"use client";

import { type ReactNode, useState } from "react";

/**
 * Contenu qui change d'état (« Je serai absent·e » → « Absence signalée ») : le nouveau arrive
 * en fondu léger. Rien au premier affichage, seulement quand `value` change.
 */
export function Swap({
  value,
  children,
  className = "",
}: {
  value: string;
  children: ReactNode;
  className?: string;
}) {
  const [seen, setSeen] = useState({ value, changed: false });
  if (seen.value !== value) setSeen({ value, changed: true });
  return (
    <span key={value} className={seen.changed ? `${className} animate-pop` : className}>
      {children}
    </span>
  );
}
