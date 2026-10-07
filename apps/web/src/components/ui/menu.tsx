"use client";

import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";
import { cn } from "@/lib/cn";
import { IconButton } from "./button";
import { KebabIcon } from "./icons";

export type MenuItem =
  | { label: string; onSelect: () => void; tone?: "danger"; disabled?: boolean }
  | { label: string; href: string; tone?: "danger" };

/** Menu « … » des lignes de liste. Se ferme au clic extérieur et avec Échap. */
export function ActionMenu({ label, items }: { label: string; items: MenuItem[] }) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const menuId = useId();

  useEffect(() => {
    if (!open) return;
    const close = (event: MouseEvent | KeyboardEvent) => {
      if (
        event instanceof KeyboardEvent
          ? event.key === "Escape"
          : !root.current?.contains(event.target as Node)
      ) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", close);
    root.current?.querySelector<HTMLElement>("[role=menuitem]")?.focus();
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", close);
    };
  }, [open]);

  const itemClasses = (tone?: "danger") =>
    cn(
      "block w-full px-4 py-2.5 text-left text-sm font-semibold transition-colors focus:outline-none disabled:opacity-50",
      tone === "danger"
        ? "text-danger hover:bg-danger-bg focus:bg-danger-bg"
        : "text-ink hover:bg-draft-bg focus:bg-draft-bg",
    );

  return (
    <div ref={root} className="relative inline-flex">
      <IconButton
        label={label}
        variant="ghost"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={menuId}
        onClick={() => setOpen((current) => !current)}
      >
        <KebabIcon />
      </IconButton>
      {open && (
        <div
          id={menuId}
          role="menu"
          className="absolute top-full right-0 z-20 mt-1 min-w-52 border-2 border-ink bg-surface py-1 shadow-[4px_4px_0_var(--color-ink)]"
        >
          {items.map((item) =>
            "href" in item ? (
              <Link
                key={item.label}
                href={item.href}
                role="menuitem"
                className={itemClasses(item.tone)}
                onClick={() => setOpen(false)}
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
                  setOpen(false);
                  item.onSelect();
                }}
              >
                {item.label}
              </button>
            ),
          )}
        </div>
      )}
    </div>
  );
}
