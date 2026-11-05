import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

/**
 * Barre d'action noire qui termine un formulaire (DA v4) : une phrase de contexte à gauche
 * (`<strong>` en blanc) et les boutons à droite, en variantes `inverse`. Sur grand écran,
 * pilule collée au bas de la zone de défilement ; sur mobile, barre fixe en bas de l'écran.
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
    <div
      className={cn(
        "fixed inset-x-0 z-30 flex items-center gap-4 bg-ink px-4 pt-3 lg:sticky lg:bottom-4 lg:rounded-full lg:py-2.5 lg:pr-2.5 lg:pl-6",
        aboveTabs
          ? "bottom-[calc(70px+env(safe-area-inset-bottom))] pb-3"
          : "bottom-0 pb-[calc(12px+env(safe-area-inset-bottom))]",
      )}
    >
      {message && (
        <p className="hidden min-w-0 flex-1 text-sm leading-[18px] text-[#9a9ea8] lg:block [&_strong]:font-semibold [&_strong]:text-white">
          {message}
        </p>
      )}
      <div className="flex flex-1 gap-2 *:flex-1 lg:flex-none lg:*:flex-none">{children}</div>
    </div>
  );
}
