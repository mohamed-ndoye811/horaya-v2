import type { ReactNode } from "react";
import { PlusIcon } from "@/components/ui/icons";
import { Link } from "@/lib/navigation";

/**
 * Action principale d'une liste sur mobile (maquette 6.2 : « + Nouveau ») : bouton noir en
 * haut à droite, à hauteur du titre. Masqué à partir de `lg`, où l'action reste dans
 * l'en-tête de page. `data-fab` : le titre de la page (PageHeader) lui laisse la place
 * (app.css), il ne passe plus dessous.
 */
export function FabLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link
      href={href}
      data-fab
      className="absolute top-4 right-4 z-20 inline-flex h-11 items-center gap-2 rounded-full bg-ink px-4 text-[15px] font-semibold leading-5 text-on-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink lg:hidden"
    >
      <PlusIcon size={14} />
      {children}
    </Link>
  );
}
