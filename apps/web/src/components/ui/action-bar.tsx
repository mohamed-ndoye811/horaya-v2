import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

/**
 * Barre d'action noire qui termine un formulaire (DA v4) : une phrase de contexte (`<strong>`
 * en relief) et les boutons, en variantes `inverse`. Sur grand écran, pilule collée au bas de
 * la zone de défilement, la phrase à gauche. Sur mobile, capsule flottante en bas de l'écran,
 * comme le menu ; la phrase passe en entier dans la page, juste au-dessus (tronquée dans la
 * capsule, elle était illisible).
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
  const strong = "[&_strong]:font-semibold";
  return (
    <>
      {message && (
        <p
          className={cn(
            "text-[13px] leading-[18px] text-ink-muted lg:hidden [&_strong]:text-ink",
            strong,
          )}
        >
          {message}
        </p>
      )}
      <div
        data-bottom-bar
        data-action-bar={aboveTabs ? undefined : ""}
        className={cn(
          "fixed inset-x-3 z-30 flex animate-rise items-center gap-4 rounded-full bg-ink p-1.5 shadow-[0_12px_32px_rgba(0,0,0,0.22)]",
          "lg:sticky lg:inset-x-auto lg:bottom-4 lg:py-2.5 lg:pr-2.5 lg:pl-6 lg:shadow-none",
          aboveTabs
            ? "bottom-[calc(76px+env(safe-area-inset-bottom))]"
            : "bottom-[calc(12px+env(safe-area-inset-bottom))]",
        )}
      >
        {message && (
          <p
            className={cn(
              "flex-1 text-sm leading-[18px] text-on-ink-muted max-lg:hidden [&_strong]:text-on-ink",
              strong,
            )}
          >
            {message}
          </p>
        )}
        <div className="flex flex-1 gap-2 *:flex-1 lg:flex-none lg:*:flex-none">{children}</div>
      </div>
    </>
  );
}
