import type { ReactNode } from "react";

/**
 * Contenu de la page : le routeur change de page en transition de vue native
 * (defaultViewTransition, voir router.tsx). Pendant la transition seulement, ce bloc porte
 * son propre nom (voir app.css ; en permanence, il passerait au-dessus des coins fixés) :
 * l'ancienne page sort en fondu, la nouvelle entre juste après ; le cadre, le notch et la
 * capsule du bas sont ancrés au-dessus (voir app.css). Sur mobile, simple fondu d'arrivée.
 * À poser dans un layout, autour du contenu seul.
 */
export function RouteTransition({ children }: { children: ReactNode }) {
  return (
    <div data-page-transition className="flex min-w-0 flex-1 flex-col max-lg:animate-fade">
      {children}
    </div>
  );
}
