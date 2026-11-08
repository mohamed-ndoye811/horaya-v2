import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

/**
 * Barre d'action noire qui termine un formulaire (DA v4) : une phrase de contexte à gauche
 * (`<strong>` en blanc) et les boutons à droite, en variantes `inverse`. Sur grand écran,
 * pilule collée au bas de la zone de défilement ; sur mobile, capsule flottante en bas de
 * l'écran, comme la barre d'onglets, avec la phrase en une ligne au-dessus des boutons.
 */
export function ActionBar({
  message,
  aboveTabs = false,
  children,
}: {
  message?: ReactNode;
  /** Sur mobile, au-dessus de la barre d'onglets (paramètres) plutôt que tout en bas. */
  aboveTabs?: boolean;
  children: ReactNode;
}) {
  return (
    <>
      {/* Sur mobile, la phrase ajoute une ligne à la barre : place réservée sous le contenu. */}
      {message && <div aria-hidden="true" className="h-6 lg:hidden" />}
      <div
        data-bottom-bar
        className={cn(
          "fixed inset-x-3 z-30 flex animate-rise flex-col gap-1.5 rounded-[24px] bg-ink p-1.5 shadow-[0_12px_32px_rgba(0,0,0,0.22)]",
          "lg:sticky lg:inset-x-auto lg:bottom-4 lg:flex-row lg:items-center lg:gap-4 lg:rounded-full lg:py-2.5 lg:pr-2.5 lg:pl-6 lg:shadow-none",
          aboveTabs
            ? "bottom-[calc(76px+env(safe-area-inset-bottom))]"
            : "bottom-[calc(12px+env(safe-area-inset-bottom))]",
        )}
      >
        {message && (
          // Mobile : une ligne courte au-dessus des boutons ; grand écran : la phrase entière à gauche.
          <p className="min-w-0 truncate px-3 pt-1.5 text-[13px] leading-4 text-on-ink-muted lg:flex-1 lg:whitespace-normal lg:p-0 lg:text-sm lg:leading-[18px] [&_strong]:font-semibold [&_strong]:text-on-ink">
            {message}
          </p>
        )}
        <div className="flex gap-2 *:flex-1 lg:flex-none lg:*:flex-none">{children}</div>
      </div>
    </>
  );
}
