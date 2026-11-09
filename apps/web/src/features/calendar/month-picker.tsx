import { type ReactNode, useEffect, useRef, useState } from "react";
import { ChevronDown, ChevronLeft, ChevronRight } from "@/components/ui/icons";
import { cn } from "@/lib/cn";
import { Link } from "@/lib/navigation";

const MONTHS = [
  "Janv.",
  "Févr.",
  "Mars",
  "Avr.",
  "Mai",
  "Juin",
  "Juil.",
  "Août",
  "Sept.",
  "Oct.",
  "Nov.",
  "Déc.",
];

/**
 * Titre du calendrier cliquable : il ouvre une grille des douze mois (année réglable) pour
 * sauter directement à un mois. Se ferme au clic à côté, avec Échap ou en choisissant.
 */
export function MonthPicker({
  year,
  month,
  today,
  hrefFor,
  children,
}: {
  /** Mois affiché. */
  year: number;
  month: number;
  today: { year: number; month: number };
  hrefFor: (year: number, month: number) => string;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [shownYear, setShownYear] = useState(year);
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointer = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={root} className="relative inline-block">
      <button
        type="button"
        aria-expanded={open}
        aria-haspopup="dialog"
        onClick={() => {
          setShownYear(year);
          setOpen(!open);
        }}
        className="-mx-2 flex items-center gap-2 rounded-2xl px-2 text-left transition-colors hover:bg-field"
      >
        {children}
        <ChevronDown className={cn("size-4 shrink-0 transition-transform", open && "rotate-180")} />
      </button>
      {open && (
        <div
          role="dialog"
          aria-label="Choisir un mois"
          className="absolute top-full left-0 z-40 mt-2 flex w-[300px] animate-drop flex-col gap-3 rounded-3xl bg-surface p-4 font-sans shadow-[0_24px_60px_rgba(0,0,0,0.16)]"
        >
          <div className="flex items-center justify-between">
            <button
              type="button"
              aria-label="Année précédente"
              onClick={() => setShownYear(shownYear - 1)}
              className="flex size-9 items-center justify-center rounded-full text-ink hover:bg-field"
            >
              <ChevronLeft />
            </button>
            <span className="text-base font-semibold text-ink">{shownYear}</span>
            <button
              type="button"
              aria-label="Année suivante"
              onClick={() => setShownYear(shownYear + 1)}
              className="flex size-9 items-center justify-center rounded-full text-ink hover:bg-field"
            >
              <ChevronRight />
            </button>
          </div>
          <div className="grid grid-cols-3 gap-1.5">
            {MONTHS.map((label, index) => {
              const value = index + 1;
              const current = shownYear === year && value === month;
              const isToday = shownYear === today.year && value === today.month;
              return (
                <Link
                  key={label}
                  href={hrefFor(shownYear, value)}
                  onClick={() => setOpen(false)}
                  aria-current={current ? "date" : undefined}
                  className={cn(
                    "flex h-10 items-center justify-center rounded-xl text-sm font-semibold transition-colors",
                    current
                      ? "bg-ink text-on-ink"
                      : isToday
                        ? "bg-accent/20 text-ink hover:bg-accent/30"
                        : "text-ink hover:bg-field",
                  )}
                >
                  {label}
                </Link>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
