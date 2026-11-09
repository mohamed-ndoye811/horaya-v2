import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/cn";
import { Link } from "@/lib/navigation";
import { ArrowRight } from "./icons";

/**
 * `inverse` et `inverse-outline` : versions pour fond noir (barres d'action, cartes noires).
 * `brand` : aux couleurs de l'espace (pages publiques). `soft` : petite pilule grise posée sur
 * une carte blanche (« Modifier », « Ajouter au calendrier »).
 */
export type ButtonVariant =
  | "primary"
  | "secondary"
  | "soft"
  | "success"
  | "danger"
  | "danger-solid"
  | "brand"
  | "inverse"
  | "inverse-outline"
  | "inverse-danger"
  | "inverse-quiet-danger";

/**
 * `xs` (36 px, 13 px) et `sm` (40 px) : actions dans une carte ou une ligne. `md` : boutons de
 * l'admin (44 px). `lg` : formulaires des écrans de compte (52 px). `xl` : bouton final des
 * pages publiques (54 px).
 */
export type ButtonSize = "xs" | "sm" | "md" | "lg" | "xl";

// Pilules de la DA v4. Appui : léger enfoncement (120 ms) ; survol : la flèche avance de 3 px.
const base =
  "group inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-full " +
  "transition-[color,background-color,border-color,scale,filter] active:scale-[0.97] active:duration-[120ms] aria-busy:animate-pulse " +
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink";

const arrowClasses = "transition-transform group-hover:translate-x-[3px]";

const sizes: Record<ButtonSize, string> = {
  xs: "h-9 px-4 text-meta leading-4",
  sm: "h-10 px-4 text-sm leading-[18px]",
  md: "h-11 px-5 text-ui leading-5",
  lg: "h-[52px] px-6 text-base",
  xl: "h-[54px] px-[26px] text-base",
};

/*
 * Désactivé, une règle par famille : noir plein → gris ; blanc ou gris à contour → texte gris,
 * plus de survol ; couleur pleine (succès, danger, marque, versions sur fond noir) → à 50 %.
 */
const variants: Record<ButtonVariant, string> = {
  primary: "bg-ink font-semibold text-on-ink hover:bg-ink-hover disabled:bg-ink-subtle",
  secondary:
    "border border-line bg-surface font-semibold text-ink hover:bg-field " +
    "disabled:text-ink-subtle disabled:hover:bg-surface",
  soft: "bg-bg font-semibold text-ink hover:bg-line disabled:text-ink-subtle disabled:hover:bg-bg",
  success:
    "bg-success font-semibold text-white hover:brightness-95 disabled:opacity-50 disabled:hover:brightness-100",
  danger:
    "border border-danger/40 bg-surface font-semibold text-danger hover:bg-danger-bg " +
    "disabled:border-line disabled:text-ink-subtle disabled:hover:bg-surface",
  /** Confirmer une action destructrice (« Annuler la réservation »). */
  "danger-solid":
    "bg-danger font-semibold text-white hover:brightness-95 disabled:opacity-50 disabled:hover:brightness-100",
  /** Couleur de l'espace (`--brand`, `--on-brand` posés par les pages publiques). */
  brand:
    "bg-[var(--brand)] font-semibold text-[var(--on-brand)] hover:brightness-110 " +
    "disabled:opacity-50 disabled:hover:brightness-100",
  inverse:
    "bg-surface font-semibold text-ink hover:bg-field focus-visible:outline-on-ink disabled:opacity-50",
  /** Refuser, sur un bandeau de décision teinté. */
  "inverse-danger": "bg-surface font-semibold text-danger hover:bg-danger-bg disabled:opacity-50",
  /** Action destructrice discrète dans une barre noire : texte seul (« Supprimer »). */
  "inverse-quiet-danger":
    "font-semibold text-on-ink-danger hover:bg-white/10 focus-visible:outline-on-ink disabled:opacity-50",
  "inverse-outline":
    "border border-ink-line font-semibold text-on-ink hover:bg-white/10 " +
    "focus-visible:outline-on-ink disabled:opacity-50 disabled:hover:bg-transparent",
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
  variant?: ButtonVariant;
  size?: ButtonSize;
  className?: string;
} = {}) {
  return cn(base, sizes[size], variants[variant], className);
}

interface ButtonProps extends ComponentProps<"button"> {
  variant?: ButtonVariant;
  size?: ButtonSize;
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
  variant?: ButtonVariant;
  size?: ButtonSize;
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
  refuse: "border border-line bg-surface text-ink hover:bg-field",
  outline: "border border-line bg-surface text-ink hover:bg-field",
  ghost: "text-ink hover:bg-field",
};

/** Boutons et liens à icône : `sm` 32 px (dans une pastille, une puce), `md` 40 px (zone de toucher). */
type IconSize = "sm" | "md";
const iconSizes: Record<IconSize, string> = { sm: "size-8", md: "size-10" };

interface IconButtonProps extends ComponentProps<"button"> {
  /** Toujours un libellé : c'est ce que lisent les lecteurs d'écran. */
  label: string;
  variant?: IconButtonVariant;
  size?: IconSize;
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
        iconSizes[size],
        iconButtonVariants[variant],
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}

/** Lien rond à icône (flèches précédent / suivant du calendrier). */
export function IconLink({
  label,
  size = "md",
  className,
  children,
  ...props
}: ComponentProps<typeof Link> & { label: string; size?: IconSize }) {
  return (
    <Link
      aria-label={label}
      title={label}
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-full border border-line bg-surface text-ink transition-[background-color,scale] hover:bg-field active:scale-[0.94]",
        iconSizes[size],
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink",
        className,
      )}
      {...props}
    >
      {children}
    </Link>
  );
}

/**
 * Lien texte souligné, comme dans les maquettes (« Mot de passe oublié ? »). Taille héritée du
 * texte autour.
 */
// Survol : le soulignement s'écarte un peu du texte (200 ms), en plus du changement de couleur.
export const textLinkClasses =
  "tap-area font-bold text-ink underline decoration-1 underline-offset-[3px] hover:text-link " +
  "transition-[color,text-underline-offset] hover:underline-offset-[5px] disabled:opacity-50 " +
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink";

/** Lien d'action de 13 px (« Modifier », « Ajouter une note », « Retirer »). */
export const textLinkSmClasses = `${textLinkClasses} text-meta leading-4`;

/**
 * Titre de ligne cliquable (nom d'un client, d'un événement dans une liste ou une fiche) :
 * gras, souligné au survol. La taille reste celle du texte autour.
 */
export const rowLinkClasses =
  "font-semibold text-ink hover:underline hover:decoration-1 hover:underline-offset-[3px] " +
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink";

/** Lien discret des en-têtes de section (« Tous les événements → »). */
export const monoLinkClasses =
  "transition-colors tap-area text-meta font-semibold text-ink hover:text-ink-muted " +
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink";
