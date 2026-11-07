import type { ComponentProps } from "react";
import { cn } from "@/lib/cn";
import { SearchIcon } from "./icons";

/** Champ de recherche : carte blanche (listes) ou champ gris (recherche secondaire). */
export function SearchInput({
  label,
  size = "md",
  className,
  ...props
}: Omit<ComponentProps<"input">, "size" | "type"> & { label: string; size?: "sm" | "md" }) {
  return (
    <label
      className={cn(
        "flex min-w-0 items-center gap-3 transition-[border-color,background-color,box-shadow]",
        size === "md"
          ? "h-11 rounded-2xl bg-surface px-4 focus-within:shadow-[0_0_0_1.5px_var(--color-ink)]"
          : "h-10 rounded-xl border border-line-soft bg-field px-3.5 focus-within:border-ink focus-within:bg-surface",
        className,
      )}
    >
      <span className="sr-only">{label}</span>
      <SearchIcon size={size === "md" ? 18 : 16} className="shrink-0 text-ink-muted" />
      <input
        type="search"
        className={cn(
          "min-w-0 grow bg-transparent font-medium text-ink outline-none placeholder:text-ink-subtle",
          // 16 px sous `lg` : pas de zoom de Safari sur iPhone au toucher.
          size === "md" ? "text-base" : "text-base lg:text-sm",
        )}
        {...props}
      />
    </label>
  );
}
