import Link from "next/link";
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import { monoLinkClasses } from "./button";

/** Titre de bloc (« À VENIR ») avec lien mono à droite. */
export function SectionHeading({
  title,
  action,
  flush = false,
  className,
}: {
  title: string;
  action?: { label: string; href: string };
  /** Sans marges latérales (titre placé dans une colonne déjà espacée). */
  flush?: boolean;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex items-center justify-between gap-4 border-b-2 border-ink py-5",
        flush ? "px-0" : "px-4 sm:pr-8 sm:pl-10",
        className,
      )}
    >
      <h2 className="font-section text-section leading-7 text-ink">{title}</h2>
      {action && (
        <Link href={action.href} className={monoLinkClasses}>
          {action.label} →
        </Link>
      )}
    </div>
  );
}

/** Section numérotée d'un formulaire (« 01 INFORMATIONS »). */
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
    <section className="flex flex-col gap-5">
      <h2 className="flex items-baseline gap-3 border-b-2 border-ink pb-2.5">
        <span className="font-mono text-label font-semibold tracking-[0.055em] text-ink-muted">
          {String(number).padStart(2, "0")}
        </span>
        <span className="font-section text-section leading-7 text-ink">{title}</span>
      </h2>
      {children}
    </section>
  );
}

/** Petit titre mono au-dessus d'un bloc (« MESSAGE DE LA CLIENTE », « HISTORIQUE »). */
export function Eyebrow({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <p
      className={cn(
        "font-mono text-label font-semibold uppercase leading-4 tracking-[0.055em] text-neutral",
        className,
      )}
    >
      {children}
    </p>
  );
}
