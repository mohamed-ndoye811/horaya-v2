"use client";

import Link from "next/link";
import {
  type KeyboardEvent as ReactKeyboardEvent,
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/cn";
import { IconButton } from "./button";
import { KebabIcon } from "./icons";

export type MenuItem =
  | { label: string; onSelect: () => void; tone?: "danger"; disabled?: boolean }
  | { label: string; href: string; tone?: "danger" };

/** Marge entre le menu et les bords de l'écran. */
const EDGE = 8;
/** Sous `lg`, la barre d'onglets occupe le bas de l'écran. */
const TAB_BAR = 80;

/**
 * Menu « … » des lignes de liste et des en-têtes. Rendu dans un portail, en position
 * fixe calculée depuis le bouton : il n'est jamais coupé par un tableau qui défile, il
 * s'ouvre vers le haut s'il manque de place en bas et reste dans l'écran (au-dessus de
 * la barre d'onglets sur mobile). Il suit son bouton quand la page défile (un défilement
 * qui finit juste après le toucher ne le ferme pas) et se ferme quand le bouton sort de
 * l'écran, au clic extérieur ou avec Échap ; flèches, Début et Fin pour passer d'une
 * entrée à l'autre.
 */
export function ActionMenu({
  label,
  items,
  variant = "ghost",
}: {
  label: string;
  items: MenuItem[];
  /** `outline` : bouton encadré, pour un en-tête à côté d'autres boutons. */
  variant?: "ghost" | "outline";
}) {
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState<{ top: number; left: number } | null>(null);
  const trigger = useRef<HTMLDivElement>(null);
  const menu = useRef<HTMLDivElement>(null);
  const menuId = useId();

  const close = useCallback((focusTrigger = false) => {
    setOpen(false);
    setPosition(null);
    if (focusTrigger) trigger.current?.querySelector("button")?.focus();
  }, []);

  // Placement : mesuré avant l'affichage, puis recalé dans l'écran.
  const place = useCallback(() => {
    if (!trigger.current || !menu.current) return;
    const anchor = trigger.current.getBoundingClientRect();
    const { width, height } = menu.current.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const bottomLimit = viewportHeight - (viewportWidth < 1024 ? TAB_BAR : EDGE);
    let left = anchor.right - width;
    if (left < EDGE) left = anchor.left;
    left = Math.max(EDGE, Math.min(left, viewportWidth - width - EDGE));
    let top = anchor.bottom + 4;
    if (top + height > bottomLimit && anchor.top - 4 - height >= EDGE)
      top = anchor.top - 4 - height;
    top = Math.max(EDGE, Math.min(top, bottomLimit - height));
    setPosition({ top, left });
  }, []);

  useLayoutEffect(() => {
    if (open) place();
  }, [open, place]);

  useEffect(() => {
    if (!open) return;
    const onPointer = (event: PointerEvent) => {
      const target = event.target as Node;
      if (!trigger.current?.contains(target) && !menu.current?.contains(target)) close();
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") close(true);
    };
    const onMove = (event: Event) => {
      if (event.type === "scroll" && menu.current?.contains(event.target as Node)) return;
      const anchor = trigger.current?.getBoundingClientRect();
      if (!anchor || anchor.bottom < 0 || anchor.top > window.innerHeight) close();
      else place();
    };
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    window.addEventListener("scroll", onMove, true);
    window.addEventListener("resize", onMove);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("scroll", onMove, true);
      window.removeEventListener("resize", onMove);
    };
  }, [open, close, place]);

  // Focus sur la première entrée dès que le menu est placé.
  useEffect(() => {
    if (open && position) {
      menu.current?.querySelector<HTMLElement>("[role=menuitem]:not(:disabled)")?.focus();
    }
  }, [open, position]);

  const onMenuKey = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    const entries = [
      ...(menu.current?.querySelectorAll<HTMLElement>("[role=menuitem]:not(:disabled)") ?? []),
    ];
    const index = entries.indexOf(document.activeElement as HTMLElement);
    const focus = (next: number) => {
      event.preventDefault();
      entries[(next + entries.length) % entries.length]?.focus();
    };
    if (event.key === "ArrowDown") focus(index + 1);
    else if (event.key === "ArrowUp") focus(index - 1);
    else if (event.key === "Home") focus(0);
    else if (event.key === "End") focus(entries.length - 1);
    else if (event.key === "Tab") close();
  };

  const itemClasses = (tone?: "danger") =>
    cn(
      "block w-full px-4 py-2.5 text-left text-sm font-semibold transition-colors focus:outline-none disabled:opacity-50",
      tone === "danger"
        ? "text-danger hover:bg-danger-bg focus:bg-danger-bg"
        : "text-ink hover:bg-draft-bg focus:bg-draft-bg",
    );

  return (
    <div ref={trigger} className="relative inline-flex">
      <IconButton
        label={label}
        variant={variant}
        size={variant === "outline" ? "lg" : "md"}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        onClick={() => (open ? close() : setOpen(true))}
      >
        <KebabIcon />
      </IconButton>
      {open &&
        createPortal(
          <div
            ref={menu}
            id={menuId}
            role="menu"
            aria-label={label}
            tabIndex={-1}
            onKeyDown={onMenuKey}
            className={cn(
              "fixed z-50 min-w-52 max-w-[calc(100vw-16px)] border-2 border-ink bg-surface py-1 shadow-[4px_4px_0_var(--color-ink)]",
              !position && "invisible",
            )}
            style={position ?? { top: 0, left: 0 }}
          >
            {items.map((item) =>
              "href" in item ? (
                <Link
                  key={item.label}
                  href={item.href}
                  role="menuitem"
                  className={itemClasses(item.tone)}
                  onClick={() => close()}
                >
                  {item.label}
                </Link>
              ) : (
                <button
                  key={item.label}
                  type="button"
                  role="menuitem"
                  disabled={item.disabled}
                  className={itemClasses(item.tone)}
                  onClick={() => {
                    close();
                    item.onSelect();
                  }}
                >
                  {item.label}
                </button>
              ),
            )}
          </div>,
          document.body,
        )}
    </div>
  );
}
