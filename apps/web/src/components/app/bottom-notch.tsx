import type { ReactNode } from "react";

/**
 * Barre du bas sur mobile (DA v4, d'après les maquettes 6.1 à 6.5) : une capsule noire posée
 * au-dessus du bord de l'écran, sous un fondu qui efface le contenu avant qu'il passe
 * dessous. Le notch pleine largeur des maquettes faisait des « pieds » aux coins et une
 * bande noire lourde dans un navigateur : la capsule garde l'idée sans ces défauts. Pas d'ombre
 * sous la capsule : sur Safari iOS, elle faisait une bande claire à bord net sous la barre
 * d'adresse. Le fondu descend 80 px sous le bas de l'écran : derrière la barre translucide de
 * Safari (`viewport-fit=cover`), on ne voit jamais où il s'arrête.
 * Masquée à partir de `lg`.
 */
export function BottomNotch({ label, children }: { label?: string; children: ReactNode }) {
  return (
    <>
      {/* Réserve la place de la capsule sous le contenu. */}
      <div aria-hidden="true" className="h-[calc(88px+env(safe-area-inset-bottom))] lg:hidden" />
      {/* Même courbe qu'avant (aplat à mi-hauteur de la partie visible), prolongée sous l'écran. */}
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-x-0 -bottom-20 z-20 [view-transition-name:tab-bar-fade] h-[calc(190px+env(safe-area-inset-bottom))] bg-[linear-gradient(to_bottom,transparent,var(--color-bg)_calc(55px+env(safe-area-inset-bottom)/2))] lg:hidden"
      />
      <nav
        aria-label={label}
        data-bottom-bar
        data-tab-capsule
        className="fixed bottom-[calc(12px+env(safe-area-inset-bottom))] left-1/2 z-30 [view-transition-name:tab-bar] flex -translate-x-1/2 rounded-full bg-ink lg:hidden"
      >
        {children}
      </nav>
    </>
  );
}
