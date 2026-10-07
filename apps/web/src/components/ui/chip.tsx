"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import { CloseIcon, PlusIcon } from "./icons";

/** Élément ajouté à une liste, retirable (« Vidéoprojecteur · Dispo × »). */
export function Chip({
  children,
  meta,
  metaTone = "success",
  onRemove,
  removeLabel,
}: {
  children: ReactNode;
  meta?: ReactNode;
  metaTone?: "success" | "warning" | "danger";
  onRemove?: () => void;
  removeLabel?: string;
}) {
  return (
    <span className="inline-flex h-10 items-center gap-2.5 border-[1.5px] border-ink bg-surface pl-3 pr-1">
      <span className="text-sm font-semibold leading-[18px] text-ink">{children}</span>
      {meta && (
        <span
          className={cn(
            "font-mono text-label font-semibold",
            metaTone === "success"
              ? "text-success"
              : metaTone === "warning"
                ? "text-warning"
                : "text-danger",
          )}
        >
          {meta}
        </span>
      )}
      {onRemove ? (
        <button
          type="button"
          onClick={onRemove}
          aria-label={removeLabel ?? "Retirer"}
          className="flex size-8 items-center justify-center text-ink hover:bg-draft-bg"
        >
          <CloseIcon size={10} />
        </button>
      ) : (
        <span className="w-2" />
      )}
    </span>
  );
}

/** Bouton d'ajout en pointillés (« + Ajouter du matériel »). */
export function AddButton({ children, onClick }: { children: ReactNode; onClick?: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex h-10 items-center gap-2 border-[1.5px] border-dashed border-ink-subtle px-3.5 text-sm font-bold text-ink hover:border-ink hover:bg-surface"
    >
      <PlusIcon size={12} />
      {children}
    </button>
  );
}

/** Choix rapide parmi des propositions (motifs de refus). */
export function ChoiceChips({
  options,
  value,
  onChange,
  label,
  name,
  tone = "danger",
}: {
  options: string[];
  value: string | null;
  onChange: (value: string) => void;
  label: string;
  name: string;
  tone?: "danger" | "ink";
}) {
  return (
    <fieldset className="flex flex-wrap gap-2">
      <legend className="sr-only">{label}</legend>
      {options.map((option) => (
        <label
          key={option}
          className={cn(
            "flex h-8 items-center border-[1.5px] px-3 text-[13px] font-bold transition-colors",
            "has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-ink",
            tone === "danger"
              ? "border-danger text-danger hover:bg-danger-bg has-checked:bg-danger has-checked:text-white"
              : "border-ink text-ink hover:bg-surface has-checked:bg-ink has-checked:text-on-ink",
          )}
        >
          <input
            type="radio"
            name={name}
            value={option}
            checked={option === value}
            onChange={() => onChange(option)}
            className="sr-only"
          />
          {option}
        </label>
      ))}
    </fieldset>
  );
}
