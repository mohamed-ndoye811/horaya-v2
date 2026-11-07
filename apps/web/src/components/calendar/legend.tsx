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
    <div className="flex flex-wrap items-center justify-between gap-4">
      <ul className="flex flex-wrap gap-x-3.5 gap-y-1.5">
        {categories.map((category) => (
          <li key={category.name} className="flex items-center gap-1.5">
            <span
              aria-hidden="true"
              className="size-2 shrink-0 rounded-[3px]"
              style={{ backgroundColor: category.color }}
            />
            <span className="text-xs font-semibold leading-4 text-ink-soft">{category.name}</span>
          </li>
        ))}
      </ul>
      {aside}
    </div>
  );
}
