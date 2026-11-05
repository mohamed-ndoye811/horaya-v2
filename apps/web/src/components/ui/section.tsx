import Link from "next/link";
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import { monoLinkClasses } from "./button";

/** Titre de bloc (« À venir ») avec lien discret à droite. */
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
        "flex items-center justify-between gap-4 pt-5 pb-3",
        flush ? "px-0" : "px-4",
        className,
      )}
    >
      <h2 className="font-headline text-section leading-7 text-ink">{title}</h2>
      {action && (
        <Link href={action.href} className={monoLinkClasses}>
          {action.label} →
        </Link>
      )}
    </div>
  );
}

/** Section numérotée d'un formulaire : pastille noire numérotée et titre (« 1 Informations »). */
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
