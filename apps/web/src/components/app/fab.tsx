import Link from "next/link";
import type { ReactNode } from "react";
import { PlusIcon } from "@/components/ui/icons";

/**
 * Bouton flottant des listes sur mobile (maquettes M5, M6, M12…) : action principale
 * posée au-dessus de la barre d'onglets. Masqué à partir de `lg`, où l'action reste
 * dans l'en-tête de page.
 */
export function FabLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <>
      {/* Laisse le bas de la liste visible sous le bouton. */}
      <div aria-hidden="true" className="h-20 lg:hidden" />
      <Link
        href={href}
        className="fixed right-5 bottom-[calc(80px+env(safe-area-inset-bottom))] z-20 inline-flex h-14 items-center gap-2.5 bg-ink px-5 text-[15px] font-bold leading-5 text-on-ink shadow-[4px_4px_0_rgb(38_68_137/0.25)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink lg:hidden"
      >
        <PlusIcon size={16} />
        {children}
      </Link>
    </>
  );
}
