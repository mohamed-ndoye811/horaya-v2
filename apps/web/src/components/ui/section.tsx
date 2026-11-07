import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import { Link } from "@/lib/navigation";

/** Carte blanche des fiches (DA v4) sans marge intérieure : coins de 24 px, ombre douce. */
export const cardShellClasses =
  "flex flex-col rounded-3xl bg-surface shadow-[0_1px_2px_rgba(0,0,0,0.04),0_16px_40px_rgba(0,0,0,0.06)]";

/** Carte blanche des fiches, avec 20 px de marge intérieure. */
export const cardClasses = `${cardShellClasses} p-5`;

/**
 * Carte noire (récapitulatif, aperçu, synthèse) : fond encre, texte clair. Le rayon et les
 * marges restent au parent (`className` de mise en page). Les textes secondaires y prennent
 * `text-on-ink-muted`, les filets `border-ink-line`.
 */
export const inkCardClasses = "bg-ink text-on-ink";

/**
 * Encadré en pointillés (zone d'ajout, dépôt de photos, note vide) : contour 1,5 px
 * `line-strong`. Le rayon et les marges restent au parent.
 */
export const dashedClasses = "border-[1.5px] border-dashed border-line-strong";

/** Titre de bloc (« À venir ») avec précision grise et lien discret à droite. */
export function SectionHeading({
  title,
  meta,
  action,
  flush = false,
  className,
}: {
  title: string;
  /** Après le titre, en gris (« 10 actions », « lundi 15 juin »). */
  meta?: string;
  action?: { label: string; href: string };
  /** Sans marges latérales (titre placé dans une colonne déjà espacée). */
  flush?: boolean;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex items-baseline justify-between gap-4 pt-5 pb-2.5",
        flush ? "px-0" : "px-4",
        className,
      )}
    >
      <h2 className="flex items-baseline gap-2.5">
        <span className="text-xl font-medium leading-[26px] text-ink">{title}</span>
        {meta && <span className="text-sm leading-[18px] text-ink-subtle">{meta}</span>}
      </h2>
      {action && (
        <Link
          href={action.href}
          className="tap-area text-sm font-semibold leading-[18px] text-ink transition-colors hover:text-ink-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
        >
          {action.label} →
        </Link>
      )}
    </div>
  );
}

/** Section numérotée d'un formulaire, dans une carte blanche (« 1 Informations »). */
export function FormSection({
  number,
  title,
  children,
}: {
  number: number;
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="flex flex-col gap-5 rounded-3xl bg-surface p-5 sm:p-6">
      <h2 className="flex items-center gap-2.5">
        <span className="flex size-[26px] shrink-0 items-center justify-center rounded-full bg-ink text-xs font-bold leading-[14px] text-on-ink">
          {number}
        </span>
        <span className="text-lg font-semibold leading-[22px] text-ink">{title}</span>
      </h2>
      {children}
    </section>
  );
}

const eyebrows = {
  default: "text-xs font-bold leading-4 text-ink-muted",
  /** Petites capitales espacées (« APERÇU DE LA FICHE »), sur fond clair ou noir. */
  caps: "text-[11px] font-bold uppercase leading-[14px] tracking-[0.06em] text-ink-subtle",
  /** Capitales en mono (sur-titres des pages publiques, en-têtes de jour). */
  mono: "font-mono text-label font-semibold uppercase leading-4 tracking-[0.055em] text-ink-muted",
  /** Titre de carte noire (« Ce mois-ci », « Bien démarrer »). */
  inverse: "text-[13px] font-semibold leading-4 text-on-ink-muted",
};

/** Petit titre au-dessus d'un bloc (« Message de la cliente », « Historique »). */
export function Eyebrow({
  variant = "default",
  children,
  className,
}: {
  variant?: keyof typeof eyebrows;
  children: ReactNode;
  className?: string;
}) {
  return <p className={cn(eyebrows[variant], className)}>{children}</p>;
}
