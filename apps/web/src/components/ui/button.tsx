import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/cn";
import { ArrowRight } from "./icons";

/** `inverse` et `inverse-outline` : versions pour fond bleu encre. */
type Variant = "primary" | "secondary" | "inverse" | "inverse-outline";

const base =
  "inline-flex h-[54px] items-center justify-center gap-3 px-6 text-base transition-colors " +
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink";

const variants: Record<Variant, string> = {
  primary: "bg-ink font-extrabold text-on-ink hover:bg-info disabled:bg-ink-subtle",
  secondary:
    "border-2 border-ink font-bold text-ink hover:bg-surface " +
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

export function buttonClasses(variant: Variant = "primary", className?: string) {
  return cn(base, variants[variant], className);
}

interface ButtonProps extends ComponentProps<"button"> {
  variant?: Variant;
  /** Flèche après le libellé (actions qui font avancer). */
  arrow?: boolean;
  pending?: boolean;
  children: ReactNode;
}

export function Button({
  variant = "primary",
  arrow = false,
  pending = false,
  className,
  children,
  disabled,
  ...props
}: ButtonProps) {
  return (
    <button
      className={buttonClasses(variant, className)}
      disabled={disabled || pending}
      aria-busy={pending || undefined}
      {...props}
    >
      {children}
      {arrow && !pending && <ArrowRight />}
    </button>
  );
}

interface ButtonLinkProps extends ComponentProps<typeof Link> {
  variant?: Variant;
  arrow?: boolean;
}

export function ButtonLink({
  variant = "primary",
  arrow = false,
  className,
  children,
  ...props
}: ButtonLinkProps) {
  return (
    <Link className={buttonClasses(variant, className)} {...props}>
      {children}
      {arrow && <ArrowRight />}
    </Link>
  );
}

/** Lien texte souligné, comme dans les maquettes (« Mot de passe oublié ? »). */
export const textLinkClasses =
  "font-bold text-ink underline decoration-1 underline-offset-[3px] hover:text-link " +
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink";
