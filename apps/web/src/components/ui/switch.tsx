"use client";

import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/cn";

/** Interrupteur carré (40 × 22) avec libellé et aide (« Événement récurrent »). */
export function Switch({
  label,
  description,
  hideLabel = false,
  className,
  ...props
}: Omit<ComponentProps<"input">, "type"> & {
  label: ReactNode;
  description?: ReactNode;
  /** Libellé lu par les lecteurs d'écran seulement (interrupteurs d'un tableau). */
  hideLabel?: boolean;
}) {
  return (
    <label className={cn("flex items-center gap-3", className)}>
      <span className="relative flex h-[22px] w-10 shrink-0">
        <input
          type="checkbox"
          className="peer absolute inset-0 appearance-none border-2 border-ink-subtle bg-surface transition-colors checked:border-ink checked:bg-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
          {...props}
        />
        <span
          aria-hidden="true"
          className="pointer-events-none absolute top-[3px] left-[3px] size-4 bg-ink-subtle transition-transform peer-checked:translate-x-[18px] peer-checked:bg-on-ink"
        />
      </span>
      <span className={hideLabel ? "sr-only" : "flex flex-col gap-0.5"}>
        <span className="text-[15px] font-bold leading-5 text-ink">{label}</span>
        {description && (
          <span className="text-[13px] font-medium leading-[18px] text-ink-muted">
            {description}
          </span>
        )}
      </span>
    </label>
  );
}
