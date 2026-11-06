import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/cn";
import { Link } from "@/lib/navigation";
import { ArrowRight } from "./icons";

/** `inverse` et `inverse-outline` : versions pour fond noir (barres d'action, cartes noires). */
type Variant =
  | "primary"
  | "secondary"
  | "success"
  | "danger"
  | "danger-solid"
  | "inverse"
  | "inverse-outline"
  | "inverse-danger";

/** `md` : boutons de l'admin (44 px). `lg` : formulaires des écrans de compte (52 px). */
type Size = "md" | "lg";

// Pilules de la DA v4. Appui : léger enfoncement (120 ms) ; survol : la flèche avance de 3 px.
const base =
  "group inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-full " +
  "transition-[color,background-color,border-color,scale] active:scale-[0.97] active:duration-[120ms] " +
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink";

const arrowClasses = "transition-transform group-hover:translate-x-[3px]";

const sizes: Record<Size, string> = {
  md: "h-11 px-5 text-[15px] leading-5",
  lg: "h-[52px] px-6 text-base",
};

const variants: Record<Variant, string> = {
  primary: "bg-ink font-semibold text-on-ink hover:bg-[#2c2c2c] disabled:bg-ink-subtle",
  secondary:
    "border border-line bg-surface font-semibold text-ink hover:bg-field " +
    "disabled:text-ink-subtle disabled:hover:bg-surface",
  success: "bg-success font-semibold text-white hover:brightness-95 disabled:opacity-50",
  danger:
    "border border-danger/40 bg-surface font-semibold text-danger hover:bg-danger-bg " +
    "disabled:border-line disabled:text-ink-subtle disabled:hover:bg-surface",
  /** Confirmer une action destructrice (« Annuler la réservation »). */
  "danger-solid": "bg-danger font-semibold text-white hover:brightness-95 disabled:opacity-50",
  inverse: "bg-surface font-semibold text-ink hover:bg-field focus-visible:outline-on-ink",
  /** Refuser, sur un bandeau de décision teinté. */
  "inverse-danger": "bg-surface font-semibold text-danger hover:bg-danger-bg",
  "inverse-outline":
    "border border-[#3a3a3a] font-semibold text-on-ink hover:bg-white/10 " +
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
      {arrow && !pending && <ArrowRight className={arrowClasses} />}
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
      {arrow && <ArrowRight className={arrowClasses} />}
    </Link>
  );
}

type IconButtonVariant = "approve" | "refuse" | "outline" | "ghost";

const iconButtonVariants: Record<IconButtonVariant, string> = {
  approve: "bg-ink text-on-ink hover:bg-ink/85",
  refuse: "border border-[#e2e2df] bg-surface text-ink hover:bg-field",
  outline: "border border-line bg-surface text-ink hover:bg-field",
  ghost: "text-ink hover:bg-field",
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
        "inline-flex shrink-0 items-center justify-center rounded-full transition-[color,background-color,border-color,scale] active:scale-[0.94] disabled:opacity-50",
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

/** Lien carré à icône (flèches précédent / suivant du calendrier). */
export function IconLink({
  label,
  className,
  children,
  ...props
}: ComponentProps<typeof Link> & { label: string }) {
  return (
    <Link
      aria-label={label}
      title={label}
      className={cn(
        "inline-flex size-10 shrink-0 items-center justify-center rounded-full border border-line bg-surface text-ink transition-[background-color,scale] hover:bg-field active:scale-[0.94]",
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink",
        className,
      )}
      {...props}
    >
      {children}
    </Link>
  );
}

/** Lien texte souligné, comme dans les maquettes (« Mot de passe oublié ? »). */
// Survol : le soulignement s'écarte un peu du texte (200 ms), en plus du changement de couleur.
export const textLinkClasses =
  "tap-area font-bold text-ink underline decoration-1 underline-offset-[3px] hover:text-link " +
  "transition-[color,text-underline-offset] hover:underline-offset-[5px] " +
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink";

/** Lien discret des en-têtes de section (« Tous les événements → »). */
export const monoLinkClasses =
  "transition-colors tap-area text-[13px] font-semibold text-ink hover:text-ink-muted " +
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink";
