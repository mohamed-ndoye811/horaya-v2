"use client";

import { usePathname } from "next/navigation";
import { type ReactNode, ViewTransition } from "react";

/**
 * Changement de page, piloté par le routeur (transition de vue native) : l'ancienne page sort en
 * fondu, la nouvelle entre juste après ; le cadre, le notch et la capsule du bas sont ancrés
 * (`view-transition-name`, voir globals.css) et ne bougent pas. Les filtres d'une même page
 * (paramètres d'URL) ne déclenchent rien.
 * Sur mobile, simple fondu d'arrivée : la capture native s'y décalait après un défilement.
 * À poser dans un layout, autour du contenu seul.
 */
export function RouteTransition({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  return (
    <ViewTransition key={pathname} enter="page-enter" exit="page-exit" default="none">
      <div className="flex min-w-0 flex-1 flex-col max-lg:animate-fade">{children}</div>
    </ViewTransition>
  );
}
