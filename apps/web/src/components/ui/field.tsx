"use client";

import { type ComponentProps, type ReactNode, useId, useState } from "react";
import { cn } from "@/lib/cn";

const inputBase =
  "w-full min-w-0 border-[1.5px] border-ink-subtle bg-surface font-medium text-ink outline-none " +
  "placeholder:text-ink-subtle transition-[border-color,box-shadow] " +
  "focus:border-ink focus:shadow-[0_0_0_0.5px_var(--color-ink)] " +
  "aria-invalid:border-danger aria-invalid:focus:shadow-[0_0_0_0.5px_var(--color-danger)] " +
  "data-[valid=true]:border-success";

const sizes = {
  md: "h-12 pl-3.5 text-base",
  lg: "h-[52px] pl-4 text-[17px]",
};

/** Marge droite : normale, ou réservée à une icône / un bouton placé dans le champ. */
const trailingPadding = {
  none: { md: "pr-3.5", lg: "pr-4" },
  icon: { md: "pr-10", lg: "pr-10" },
  action: { md: "pr-24", lg: "pr-24" },
};

export type InputSize = keyof typeof sizes;

export function inputClasses(
  size: InputSize = "md",
  trailing: keyof typeof trailingPadding = "none",
) {
  return cn(inputBase, sizes[size], trailingPadding[trailing][size]);
}

interface FieldProps {
  label: string;
  error?: string | undefined;
  hint?: ReactNode;
  children: (props: {
    id: string;
    "aria-invalid"?: true;
    "aria-describedby"?: string;
  }) => ReactNode;
}

/** Libellé + champ + message d'erreur, reliés pour les lecteurs d'écran. */
export function Field({ label, error, hint, children }: FieldProps) {
  const id = useId();
  const messageId = `${id}-message`;
  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={id} className="text-sm font-bold leading-[18px] text-ink">
        {label}
      </label>
      {children({
        id,
        ...(error ? { "aria-invalid": true as const, "aria-describedby": messageId } : {}),
      })}
      {error ? (
        <p id={messageId} className="text-[13px] font-semibold leading-4 text-danger">
          {error}
        </p>
      ) : (
        hint
      )}
    </div>
  );
}

interface PasswordInputProps extends Omit<ComponentProps<"input">, "type" | "size" | "className"> {
  inputSize?: InputSize;
}

/** Champ mot de passe avec bouton « Afficher / Masquer ». */
export function PasswordInput({ inputSize = "md", ...props }: PasswordInputProps) {
  const [visible, setVisible] = useState(false);
  return (
    <div className="relative">
      <input
        {...props}
        type={visible ? "text" : "password"}
        className={inputClasses(inputSize, "action")}
      />
      <button
        type="button"
        onClick={() => setVisible((current) => !current)}
        className="absolute inset-y-0 right-0 px-3.5 text-[13px] font-bold text-ink underline decoration-1 underline-offset-[3px] hover:text-link"
        aria-label={visible ? "Masquer le mot de passe" : "Afficher le mot de passe"}
      >
        {visible ? "Masquer" : "Afficher"}
      </button>
    </div>
  );
}

interface CheckboxProps extends Omit<ComponentProps<"input">, "type"> {
  label: ReactNode;
}

/** Case à cocher carrée (pas d'arrondis dans le système Horaya). */
export function Checkbox({ label, className, ...props }: CheckboxProps) {
  return (
    <label className={cn("flex cursor-pointer items-start gap-2.5", className)}>
      <span className="relative mt-px flex size-5 shrink-0">
        <input
          type="checkbox"
          className="peer size-5 cursor-pointer appearance-none border-2 border-ink-subtle bg-surface checked:border-ink checked:bg-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
          {...props}
        />
        <svg
          width="12"
          height="10"
          viewBox="0 0 12 10"
          aria-hidden="true"
          className="pointer-events-none absolute top-[5px] left-1 hidden text-on-ink peer-checked:block"
        >
          <path d="M1 5L4.5 8.5L11 1.5" fill="none" stroke="currentColor" strokeWidth="2" />
        </svg>
      </span>
      <span className="text-sm font-semibold leading-5 text-ink">{label}</span>
    </label>
  );
}
