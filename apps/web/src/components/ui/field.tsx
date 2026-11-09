"use client";

import { type ComponentProps, type ReactNode, useId, useState } from "react";
import { cn } from "@/lib/cn";
import { useInvalidMessage } from "@/lib/use-invalid-message";

// DA v4 : champ gris clair arrondi, qui blanchit et prend un contour noir au focus.
const inputBase =
  "min-w-0 rounded-xl border border-line-soft bg-field font-medium text-ink outline-none " +
  "placeholder:text-ink-subtle transition-[border-color,background-color,box-shadow] " +
  "focus:border-ink focus:bg-surface " +
  "aria-invalid:border-danger aria-invalid:focus:shadow-[0_0_0_0.5px_var(--color-danger)] " +
  "data-[valid=true]:border-success";

/*
 * Sous `lg`, texte des champs à 16 px au moins : en dessous, Safari sur iPhone zoome la page
 * dès qu'on touche le champ.
 */
const sizes = {
  /** 36 px : champ d'une ligne dense (constructeur de règle, fenêtre compacte). */
  xs: "h-9 pl-3 text-base lg:text-[13px]",
  /** 40 px : champ dans une ligne ou à côté d'une pastille (code couleur). */
  sm: "h-10 pl-3.5 text-base lg:text-sm",
  md: "h-11 pl-3.5 text-base lg:text-[15px]",
  lg: "h-[52px] pl-4 text-base",
};

/** Marge droite : normale, ou réservée à une icône / un bouton placé dans le champ. */
const trailingPadding = {
  none: { xs: "pr-3", sm: "pr-3.5", md: "pr-3.5", lg: "pr-4" },
  icon: { xs: "pr-9", sm: "pr-10", md: "pr-10", lg: "pr-10" },
  action: { xs: "pr-24", sm: "pr-24", md: "pr-24", lg: "pr-24" },
};

export type InputSize = keyof typeof sizes;

/** `width` : « fit » laisse la largeur au parent (champ court dans une ligne de contrôles). */
export function inputClasses(
  size: InputSize = "md",
  trailing: keyof typeof trailingPadding = "none",
  width: "full" | "fit" = "full",
) {
  return cn(inputBase, width === "full" && "w-full", sizes[size], trailingPadding[trailing][size]);
}

interface FieldProps {
  label: string;
  /** Astérisque rouge après le libellé. */
  required?: boolean;
  /** Information à droite du libellé (compteur « 312 / 2000 »). */
  aside?: ReactNode;
  /** Groupe de choix (boutons radio) : libellé simple, le groupe porte son propre nom. */
  group?: boolean;
  error?: string | undefined;
  hint?: ReactNode;
  children: (props: {
    id: string;
    "aria-invalid"?: true;
    "aria-describedby"?: string;
  }) => ReactNode;
}

/** Message d'erreur sous un champ (13 px, rouge, gras). `id` : à relier par `aria-describedby`. */
export function FieldError({ id, children }: { id?: string; children: ReactNode }) {
  return (
    <p id={id} className="animate-drop text-[13px] font-semibold leading-4 text-danger">
      {children}
    </p>
  );
}

/**
 * Libellé + champ + message d'erreur, reliés pour les lecteurs d'écran. Un champ refusé
 * par le navigateur (obligatoire, e-mail…) affiche son message ici, sans bulle.
 */
export function Field({
  label,
  required,
  aside,
  group,
  error: serverError,
  hint,
  children,
}: FieldProps) {
  const id = useId();
  const messageId = `${id}-message`;
  const invalid = useInvalidMessage();
  const error = invalid.message ?? serverError;
  return (
    <div className="flex flex-col gap-2" {...invalid.handlers}>
      <div className="flex items-baseline justify-between gap-3">
        {(() => {
          const content = (
            <>
              {label}
              {required && (
                <span aria-hidden="true" className="ml-1 text-danger">
                  *
                </span>
              )}
            </>
          );
          const className = "text-[13px] font-semibold leading-[17px] text-ink";
          return group ? (
            <span className={className}>{content}</span>
          ) : (
            <label htmlFor={id} className={className}>
              {content}
            </label>
          );
        })()}
        {aside && (
          <span className="font-mono text-label font-semibold leading-4 text-ink-muted">
            {aside}
          </span>
        )}
      </div>
      {children({
        id,
        ...(error ? { "aria-invalid": true as const, "aria-describedby": messageId } : {}),
      })}
      {error ? <FieldError id={messageId}>{error}</FieldError> : hint}
    </div>
  );
}

/** Zone de texte multiligne (description). */
export function textareaClasses() {
  return cn(inputBase, "w-full min-h-32 resize-y px-3.5 py-3 text-base leading-[23px]");
}

interface AffixInputProps extends Omit<ComponentProps<"input">, "size" | "className" | "prefix"> {
  /** Texte fixe collé au bord gauche, sur fond gris (« horaya.app/ »). */
  prefix?: ReactNode;
  /** Icône avant la valeur (calendrier, repère). */
  leading?: ReactNode;
  /** Unité après la valeur (« places », « € TTC »). */
  suffix?: ReactNode;
  /** Chiffres en mono, comme les maquettes (places, prix, heures). */
  mono?: boolean;
  /** `xs` : 36 px de haut, pour les fenêtres compactes. */
  size?: "xs" | "md";
}

/** Champ avec préfixe, icône et/ou unité intégrés ; le cadre réagit au focus du champ. */
export function AffixInput({
  prefix,
  leading,
  suffix,
  mono = false,
  size = "md",
  ...props
}: AffixInputProps) {
  return (
    <div
      className={cn(
        "flex min-w-0 items-center gap-2.5 overflow-hidden rounded-xl border border-line-soft bg-field transition-[border-color,background-color]",
        size === "xs" ? "h-9 px-3" : "h-11 px-3.5",
        "focus-within:border-ink focus-within:bg-surface",
        "has-aria-invalid:border-danger",
      )}
    >
      {prefix && (
        <span className="-ml-3.5 flex shrink-0 items-center self-stretch border-r border-line-soft bg-line-soft px-3.5 text-sm text-ink-subtle">
          {prefix}
        </span>
      )}
      {leading && <span className="flex shrink-0 text-ink-muted">{leading}</span>}
      <input
        className={cn(
          "h-full min-w-0 grow bg-transparent text-ink outline-none placeholder:text-ink-subtle",
          mono ? "font-mono text-base font-semibold lg:text-[15px]" : "text-base font-medium",
        )}
        {...props}
      />
      {suffix && <span className="shrink-0 text-sm font-medium text-ink-muted">{suffix}</span>}
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

/** Case à cocher aux coins doux (DA v4). */
export function Checkbox({ label, className, ...props }: CheckboxProps) {
  const invalid = useInvalidMessage();
  const messageId = useId();
  const box = (
    <label className={cn("flex items-start gap-2.5", className)}>
      <span className="relative mt-px flex size-5 shrink-0">
        <input
          type="checkbox"
          className="peer size-5 appearance-none rounded-md border-[1.5px] border-line bg-surface checked:border-ink checked:bg-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink aria-invalid:border-danger"
          {...(invalid.message ? { "aria-invalid": true, "aria-describedby": messageId } : {})}
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
  // Seule une case obligatoire (conditions) peut être refusée par le navigateur.
  if (!props.required) return box;
  return (
    <div className="flex flex-col gap-2" {...invalid.handlers}>
      {box}
      {invalid.message && <FieldError id={messageId}>{invalid.message}</FieldError>}
    </div>
  );
}
