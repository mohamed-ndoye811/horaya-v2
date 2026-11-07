import type { ReactNode } from "react";

/**
 * Barre du bas sur mobile (DA v4, d'après les maquettes 6.1 à 6.5) : une capsule noire posée
 * au-dessus du bord de l'écran, sous un fondu qui efface le contenu avant qu'il passe
 * dessous. Le notch pleine largeur des maquettes faisait des « pieds » aux coins et une
 * bande noire lourde dans un navigateur : la capsule garde l'idée sans ces défauts.
 * Masquée à partir de `lg`.
 */
export function BottomNotch({ label, children }: { label?: string; children: ReactNode }) {
  return (
    <>
      {/* Réserve la place de la capsule sous le contenu. */}
      <div aria-hidden="true" className="h-[calc(88px+env(safe-area-inset-bottom))] lg:hidden" />
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-x-0 bottom-0 z-20 [view-transition-name:tab-bar-fade] h-[calc(110px+env(safe-area-inset-bottom))] bg-linear-to-b from-bg/0 via-bg via-50% to-bg lg:hidden"
      />
      <nav
        aria-label={label}
        data-bottom-bar
        className="fixed bottom-[calc(12px+env(safe-area-inset-bottom))] left-1/2 z-30 [view-transition-name:tab-bar] flex min-w-[250px] -translate-x-1/2 items-center justify-between gap-3 rounded-[24px] bg-ink p-1.5 shadow-[0_12px_32px_rgba(0,0,0,0.22)] lg:hidden"
      >
        {children}
      </nav>
    </>
  );
}
