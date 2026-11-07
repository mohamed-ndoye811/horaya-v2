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
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: ReactNode;
  children?: ReactNode;
  footer?: ReactNode;
  size?: "md" | "lg";
}) {
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
        size === "md" ? "max-w-[520px]" : "max-w-[720px]",
      )}
    >
      <div className="flex flex-col">
        <header className="flex items-start justify-between gap-4 px-6 pt-6 pb-2">
          <div className="flex flex-col gap-1">
            <h2 id={titleId} className="font-headline text-2xl leading-7">
              {title}
            </h2>
            {description && (
              <p className="text-sm font-medium leading-5 text-ink-muted">{description}</p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fermer"
            className="flex size-10 shrink-0 items-center justify-center rounded-full bg-field hover:bg-line-soft"
          >
            <CloseIcon />
          </button>
        </header>
        {children && <div className="px-6 py-4">{children}</div>}
        {footer && (
          <footer className="flex flex-wrap justify-end gap-2 px-6 pt-2 pb-6">{footer}</footer>
        )}
      </div>
    </dialog>
  );
}
