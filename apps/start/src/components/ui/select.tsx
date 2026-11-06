import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/cn";
import { ChevronDown } from "./icons";

type SelectVariant = "field" | "filter" | "compact";

const variants: Record<SelectVariant, string> = {
  /** Dans un formulaire : comme un champ texte. */
  field:
    "h-11 rounded-xl border border-line-soft bg-field pl-3.5 pr-10 text-[15px] font-medium focus:border-ink focus:bg-surface",
  /** Filtre de liste : pilule blanche, texte gras. */
  filter: "h-10 rounded-full bg-surface pl-4 pr-10 text-sm font-semibold hover:bg-field",
  /** Dans une ligne de tableau (rôle d'un membre) ou une carte. */
  compact:
    "h-10 rounded-xl border border-line-soft bg-field pl-3.5 pr-10 text-sm font-semibold focus:border-ink focus:bg-surface",
};

/**
 * Liste déroulante native stylée (accessible et mobile par défaut).
 * `leading` : élément affiché avant le texte, ex. carré de couleur d'un type.
 */
export function Select({
  variant = "field",
  leading,
  className,
  children,
  ...props
}: ComponentProps<"select"> & { variant?: SelectVariant; leading?: ReactNode }) {
  return (
    <div className={cn("relative min-w-0", className)}>
      {leading && (
        <span className="pointer-events-none absolute top-1/2 left-3.5 flex -translate-y-1/2">
          {leading}
        </span>
      )}
      <select
        className={cn(
          "w-full min-w-0 appearance-none text-ink outline-none transition-[border-color,box-shadow]",
          "aria-invalid:border-danger disabled:cursor-not-allowed disabled:bg-draft-bg disabled:text-ink-muted",
          variants[variant],
          leading ? "pl-9" : undefined,
        )}
        {...props}
      >
        {children}
      </select>
      <ChevronDown className="pointer-events-none absolute top-1/2 right-3.5 -translate-y-1/2 text-ink" />
    </div>
  );
}
