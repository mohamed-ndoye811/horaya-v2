"use client";

import { type ReactNode, useEffect, useId, useRef } from "react";
import { cn } from "@/lib/cn";
import { CloseIcon } from "./icons";

/**
 * Fenêtre modale sur <dialog> natif : focus piégé, Échap et fond gérés par le navigateur.
 * Contrôlée : `open` / `onClose`. Sous `sm`, feuille qui monte du bas de l'écran.
 */
export function Dialog({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  size = "md",
  density = "regular",
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: ReactNode;
  children?: ReactNode;
  footer?: ReactNode;
  /** `xl` : choix en grille (modèles d'un nouveau type). */
  size?: "md" | "lg" | "xl";
  /** `compact` : titre plus petit, marges serrées, pied séparé d'un filet (fenêtres d'édition denses). */
  density?: "regular" | "compact";
}) {
  const compact = density === "compact";
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    // biome-ignore lint/a11y/useKeyWithClickEvents: Échap est géré nativement par <dialog> ; le clic ne sert qu'au fond.
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      onClose={onClose}
      onClick={(event) => {
        // Clic sur le fond (hors du contenu) : on ferme.
        if (event.target === event.currentTarget) onClose();
      }}
      className={cn(
        "m-auto w-[calc(100%-32px)] rounded-[28px] bg-surface p-0 text-left text-ink shadow-[0_24px_80px_rgba(0,0,0,0.22)] backdrop:bg-ink/35",
        "max-sm:mb-0 max-sm:w-full max-sm:max-w-none max-sm:rounded-b-none max-sm:pb-[env(safe-area-inset-bottom)]",
        size === "md" ? "max-w-[520px]" : size === "lg" ? "max-w-[720px]" : "max-w-[960px]",
      )}
    >
      <div className="flex flex-col">
        <header
          className={cn(
            "flex items-start justify-between gap-4",
            compact ? "px-5 pt-4 pb-1" : "px-6 pt-6 pb-2",
          )}
        >
          <div className={cn("flex flex-col", compact ? "gap-0.5" : "gap-1")}>
            <h2
              id={titleId}
              className={cn("font-headline", compact ? "text-lg leading-6" : "text-2xl leading-7")}
            >
              {title}
            </h2>
            {description && (
              <p
                className={cn(
                  "font-medium text-ink-muted",
                  compact ? "text-meta leading-[18px]" : "text-sm leading-5",
                )}
              >
                {description}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fermer"
            className={cn(
              "flex shrink-0 items-center justify-center rounded-full bg-field hover:bg-line-soft",
              compact ? "size-8" : "size-10",
            )}
          >
            <CloseIcon size={compact ? 10 : undefined} />
          </button>
        </header>
        {children && <div className={compact ? "px-5 py-3" : "px-6 py-4"}>{children}</div>}
        {/* Collé en bas quand le contenu défile : les boutons restent à portée. */}
        {footer && (
          <footer
            className={cn(
              "sticky bottom-0 flex flex-wrap justify-end gap-2 bg-surface",
              compact ? "border-t border-line-soft px-5 py-3" : "px-6 pt-2 pb-6",
            )}
          >
            {footer}
          </footer>
        )}
      </div>
    </dialog>
  );
}
