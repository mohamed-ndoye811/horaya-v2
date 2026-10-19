"use client";

import { usePathname } from "next/navigation";
import { type ReactNode, ViewTransition } from "react";

/**
 * Changement de page : l'ancienne s'efface, la nouvelle monte de 8 px (classe `page` de
 * globals.css). Les filtres d'une même page (paramètres d'URL) ne déclenchent rien.
 * À poser dans un layout, autour du contenu seul : la navigation ne bouge pas.
 */
export function RouteTransition({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  return (
    <ViewTransition key={pathname} enter="page" exit="page" default="none">
      {children}
    </ViewTransition>
  );
}
