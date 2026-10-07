import type { ReactNode } from "react";

/** Légende des types d'événements, avec un réglage à droite (« Tous les calendriers »). */
export function CalendarLegend({
  categories,
  aside,
}: {
  categories: Array<{ name: string; color: string }>;
  aside?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-4 border-b-2 border-ink px-4 py-3.5 sm:px-10">
      <ul className="flex flex-wrap gap-x-6 gap-y-2">
        {categories.map((category) => (
          <li key={category.name} className="flex items-center gap-2">
            <span
              aria-hidden="true"
              className="size-3 shrink-0"
              style={{ backgroundColor: category.color }}
            />
            <span className="font-mono text-label font-semibold uppercase tracking-[0.055em] text-neutral">
              {category.name}
            </span>
          </li>
        ))}
      </ul>
      {aside}
    </div>
  );
}
