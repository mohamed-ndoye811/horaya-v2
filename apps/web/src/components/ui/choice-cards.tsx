"use client";

import { useId } from "react";
import { cn } from "@/lib/cn";

/** Choix exclusif avec description (« Mode de paiement »). */
export function ChoiceCards({
  options,
  name,
  label,
  value,
  defaultValue,
  onChange,
}: {
  options: Array<{ value: string; label: string; description: string }>;
  name: string;
  label: string;
  value?: string;
  defaultValue?: string;
  onChange?: (value: string) => void;
}) {
  const id = useId();
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className="grid grid-cols-2 border-2 border-ink bg-ink gap-0.5 md:flex md:gap-0"
    >
      {options.map((option) => {
        const inputId = `${id}-${option.value}`;
        return (
          <label
            key={option.value}
            htmlFor={inputId}
            className={cn(
              "group flex flex-1 basis-0 flex-col gap-0.5 bg-bg px-3.5 py-3 transition-colors hover:bg-surface",
              "md:[&:not(:first-child)]:border-l-2 md:[&:not(:first-child)]:border-ink",
              "has-checked:bg-ink has-focus-visible:outline-2 has-focus-visible:-outline-offset-4 has-focus-visible:outline-on-ink",
            )}
          >
            <input
              id={inputId}
              type="radio"
              name={name}
              value={option.value}
              className="sr-only"
              {...(value !== undefined
                ? { checked: value === option.value, onChange: () => onChange?.(option.value) }
                : { defaultChecked: defaultValue === option.value })}
            />
            <span className="text-sm font-bold leading-[18px] text-ink group-has-checked:text-on-ink">
              {option.label}
            </span>
            <span className="text-label font-medium leading-4 text-ink-muted group-has-checked:text-on-ink/80">
              {option.description}
            </span>
          </label>
        );
      })}
    </div>
  );
}
