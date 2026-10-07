import type { ComponentProps } from "react";
import { cn } from "@/lib/cn";
import { SearchIcon } from "./icons";

/** Champ de recherche : cadre encre 2 px (listes) ou fin (recherche secondaire). */
export function SearchInput({
  label,
  size = "md",
  className,
  ...props
}: Omit<ComponentProps<"input">, "size" | "type"> & { label: string; size?: "sm" | "md" }) {
  return (
    <label
      className={cn(
        "flex min-w-0 items-center gap-3 bg-surface transition-[border-color,box-shadow]",
        "focus-within:shadow-[0_0_0_0.5px_var(--color-ink)]",
        size === "md"
          ? "h-12 border-2 border-ink px-4"
          : "h-10 border-[1.5px] border-ink-subtle px-3.5 focus-within:border-ink",
        className,
      )}
    >
      <span className="sr-only">{label}</span>
      <SearchIcon size={size === "md" ? 18 : 16} className="shrink-0 text-ink-muted" />
      <input
        type="search"
        className={cn(
          "min-w-0 grow bg-transparent font-medium text-ink outline-none placeholder:text-ink-subtle",
          size === "md" ? "text-base" : "text-sm",
        )}
        {...props}
      />
    </label>
  );
}
