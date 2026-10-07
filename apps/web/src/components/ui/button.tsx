import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/cn";
import { ArrowRight } from "./icons";

/** `inverse` et `inverse-outline` : versions pour fond bleu encre. */
type Variant = "primary" | "secondary" | "success" | "danger" | "inverse" | "inverse-outline";

/** `md` : boutons de l'admin (48 px). `lg` : formulaires des écrans de compte (54 px). */
type Size = "md" | "lg";

const base =
  "inline-flex shrink-0 items-center justify-center gap-2.5 whitespace-nowrap transition-colors " +
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink";

const sizes: Record<Size, string> = {
  md: "h-12 px-5 text-[15px] leading-5",
  lg: "h-[54px] px-6 text-base",
};

const variants: Record<Variant, string> = {
  primary: "bg-ink font-extrabold text-on-ink hover:bg-info disabled:bg-ink-subtle",
  secondary:
    "border-2 border-ink font-bold text-ink hover:bg-surface " +
    "disabled:border-ink-subtle disabled:text-ink-subtle disabled:hover:bg-transparent",
  success: "bg-success font-extrabold text-white hover:brightness-95 disabled:opacity-50",
  danger:
    "border-2 border-danger font-bold text-danger hover:bg-danger-bg " +
    "disabled:border-ink-subtle disabled:text-ink-subtle disabled:hover:bg-transparent",
  inverse: "bg-on-ink font-extrabold text-ink hover:bg-surface focus-visible:outline-on-ink",
  "inverse-outline":
    "border-2 border-on-ink font-bold text-on-ink hover:bg-on-ink hover:text-ink " +
    "focus-visible:outline-on-ink",
};

/*
 * Pas de fusion de classes (pas de tailwind-merge) : `className` ne doit servir qu'à la mise
 * en page (largeur, marges), jamais à surcharger couleurs ou bordures — créer une variante.
 */
export function buttonClasses({
  variant = "primary",
  size = "md",
  className,
}: {
  variant?: Variant;
  size?: Size;
  className?: string;
} = {}) {
  return cn(base, sizes[size], variants[variant], className);
}

interface ButtonProps extends ComponentProps<"button"> {
  variant?: Variant;
  size?: Size;
  /** Icône avant le libellé (ex. « + » de « Nouvel événement »). */
  icon?: ReactNode;
  /** Flèche après le libellé (actions qui font avancer). */
  arrow?: boolean;
  pending?: boolean;
  children: ReactNode;
}

export function Button({
  variant = "primary",
  size = "md",
  icon,
  arrow = false,
  pending = false,
  className,
  children,
  disabled,
  type = "button",
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      className={buttonClasses({ variant, size, className })}
      disabled={disabled || pending}
      aria-busy={pending || undefined}
      {...props}
    >
      {icon}
      {children}
      {arrow && !pending && <ArrowRight />}
    </button>
  );
}

interface ButtonLinkProps extends ComponentProps<typeof Link> {
  variant?: Variant;
  size?: Size;
  icon?: ReactNode;
  arrow?: boolean;
}

export function ButtonLink({
  variant = "primary",
  size = "md",
  icon,
  arrow = false,
  className,
  children,
  ...props
}: ButtonLinkProps) {
  return (
    <Link className={buttonClasses({ variant, size, className })} {...props}>
      {icon}
      {children}
      {arrow && <ArrowRight />}
    </Link>
  );
}

type IconButtonVariant = "approve" | "refuse" | "outline" | "ghost";

const iconButtonVariants: Record<IconButtonVariant, string> = {
  approve: "bg-success text-white hover:brightness-95",
  refuse: "border-2 border-danger text-danger hover:bg-danger-bg",
  outline: "border-2 border-ink text-ink hover:bg-surface",
  ghost: "text-ink hover:bg-draft-bg",
};

interface IconButtonProps extends ComponentProps<"button"> {
  /** Toujours un libellé : c'est ce que lisent les lecteurs d'écran. */
  label: string;
  variant?: IconButtonVariant;
  size?: "sm" | "md" | "lg";
}

/** Bouton carré à icône (valider, refuser, précédent, menu…). */
export function IconButton({
  label,
  variant = "outline",
  size = "md",
  className,
  type = "button",
  children,
  ...props
}: IconButtonProps) {
  return (
    <button
      type={type}
      aria-label={label}
      title={label}
      className={cn(
        "inline-flex shrink-0 items-center justify-center transition-colors disabled:opacity-50",
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink",
        size === "sm" ? "size-6" : size === "md" ? "size-9" : "size-10",
        iconButtonVariants[variant],
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}

/** Lien texte souligné, comme dans les maquettes (« Mot de passe oublié ? »). */
export const textLinkClasses =
  "font-bold text-ink underline decoration-1 underline-offset-[3px] hover:text-link " +
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink";

/** Lien en capitales mono des en-têtes de section (« TOUS LES ÉVÉNEMENTS → »). */
export const monoLinkClasses =
  "font-mono text-label font-semibold uppercase tracking-[0.055em] text-ink hover:text-link " +
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink";
