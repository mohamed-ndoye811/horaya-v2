import type { ReactNode } from "react";

/** Bord du notch du bas (maquette 6.1 : 378 × 70) ; le côté droit est le même, retourné. */
const SIDE = "M0 70 L0 26 C0 39.3 10.7 50 24 50 C56 50 46 0 82 0 L82 70 Z";

/**
 * Notch noir collé au bas de l'écran sur mobile (DA v4, maquettes 6.1 à 6.5), sous un fondu
 * qui efface le contenu avant qu'il passe dessous. `children` se pose au centre, dans la
 * bosse (226 à 234 px de large). Masqué à partir de `lg`.
 */
export function BottomNotch({ label, children }: { label?: string; children: ReactNode }) {
  return (
    <>
      {/* Réserve la place du notch sous le contenu. */}
      <div aria-hidden="true" className="h-[calc(96px+env(safe-area-inset-bottom))] lg:hidden" />
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-x-0 bottom-0 z-20 h-[calc(126px+env(safe-area-inset-bottom))] bg-linear-to-b from-bg/0 via-bg via-40% to-bg lg:hidden"
      />
      <nav aria-label={label} className="fixed inset-x-0 bottom-0 z-30 flex flex-col lg:hidden">
        <div className="relative flex h-[70px]">
          <svg
            width="82"
            height="70"
            viewBox="0 0 82 70"
            aria-hidden="true"
            className="shrink-0 fill-ink"
          >
            <path d={SIDE} />
          </svg>
          <span aria-hidden="true" className="flex-1 bg-ink" />
          <svg
            width="82"
            height="70"
            viewBox="0 0 82 70"
            aria-hidden="true"
            className="shrink-0 -scale-x-100 fill-ink"
          >
            <path d={SIDE} />
          </svg>
          <div className="absolute top-1.5 left-1/2 flex w-[234px] -translate-x-1/2 items-center justify-between">
            {children}
          </div>
        </div>
        <div aria-hidden="true" className="h-[env(safe-area-inset-bottom)] bg-ink" />
      </nav>
    </>
  );
}
