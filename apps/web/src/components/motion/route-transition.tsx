"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

/**
 * Changement de page : la nouvelle page apparaît en fondu (200 ms), ses éléments arrivent
 * ensuite d'eux-mêmes (`reveal`). Les filtres d'une même page (paramètres d'URL) ne
 * déclenchent rien. Plus de transition de vue native : sa capture se posait au-dessus du
 * notch et de la capsule du bas, et se décalait quand la page avait défilé (mobile).
 * À poser dans un layout, autour du contenu seul : la navigation ne bouge pas.
 */
export function RouteTransition({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  return (
    <div key={pathname} className="flex min-w-0 flex-1 animate-fade flex-col">
      {children}
    </div>
  );
}
