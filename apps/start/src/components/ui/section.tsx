import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import { Link } from "@/lib/navigation";

/** Carte blanche des fiches (DA v4) sans marge intérieure : coins de 24 px, ombre douce. */
export const cardShellClasses =
  "flex flex-col rounded-3xl bg-surface shadow-[0_1px_2px_rgba(0,0,0,0.04),0_16px_40px_rgba(0,0,0,0.06)]";

/** Carte blanche des fiches, avec 20 px de marge intérieure. */
export const cardClasses = `${cardShellClasses} p-5`;

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
        {meta && <span className="text-sm leading-[18px] text-[#8a8a8a]">{meta}</span>}
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

/** Petit titre au-dessus d'un bloc (« Message de la cliente », « Historique »). */
export function Eyebrow({ children, className }: { children: ReactNode; className?: string }) {
  return <p className={cn("text-xs font-bold leading-4 text-ink-muted", className)}>{children}</p>;
}
