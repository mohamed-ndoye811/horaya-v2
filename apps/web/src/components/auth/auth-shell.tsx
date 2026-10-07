import Link from "next/link";
import type { ReactNode } from "react";
import { textLinkClasses } from "@/components/ui/button";
import { cn } from "@/lib/cn";

const CATEGORY_SQUARES = [
  "bg-cat-seminaire",
  "bg-cat-atelier",
  "bg-cat-reunion",
  "bg-cat-meetup",
] as const;

export function Wordmark({ className }: { className?: string }) {
  return (
    <Link href="/" className={cn("font-headline text-[40px] leading-10", className)}>
      Horaya
    </Link>
  );
}

export function CategorySquares() {
  return (
    <div className="flex gap-2.5" aria-hidden="true">
      {CATEGORY_SQUARES.map((color) => (
        <span key={color} className={cn("size-3.5", color)} />
      ))}
    </div>
  );
}

/** Panneau de marque par défaut (écrans 01 à 14). */
export function BrandAside() {
  return (
    <div className="flex flex-col gap-7">
      <p className="font-headline text-[clamp(56px,6.1vw,88px)] leading-[0.93]">
        Planifie avec style.
      </p>
      <p className="max-w-[440px] text-[19px] font-medium leading-7 opacity-85">
        Tes réservations, tes événements, ton matériel — dans un seul agenda, sous ta marque.
      </p>
    </div>
  );
}

interface AuthShellProps {
  /** Contenu central du panneau bleu (accroche par défaut). */
  aside?: ReactNode;
  /** Lien en haut à droite (« Pas encore de compte ? Créer un espace »). */
  topLink?: { prompt: string; label: string; href: string };
  footnote?: ReactNode;
  /** Largeur de la colonne de formulaire. */
  width?: "md" | "lg";
  children: ReactNode;
}

/** Mise en page des écrans de compte : panneau de marque à gauche, formulaire à droite. */
export function AuthShell({
  aside = <BrandAside />,
  topLink,
  footnote,
  width = "md",
  children,
}: AuthShellProps) {
  return (
    <div className="flex min-h-dvh flex-1">
      <aside className="hidden w-[44%] max-w-[640px] shrink-0 flex-col justify-between gap-12 bg-ink p-14 text-on-ink lg:flex">
        <Wordmark />
        {aside}
        <CategorySquares />
      </aside>

      <main className="flex flex-1 flex-col items-center justify-between gap-12 px-4 py-6 sm:px-12 lg:px-24 lg:py-14">
        <div className="flex w-full items-center justify-between gap-4 lg:justify-end">
          <Wordmark className="text-[32px] leading-8 lg:hidden" />
          {topLink && (
            <p className="flex flex-wrap justify-end gap-x-2 text-right text-[15px] leading-5">
              <span className="hidden font-medium text-ink-muted sm:inline">{topLink.prompt}</span>
              <Link href={topLink.href} className={textLinkClasses}>
                {topLink.label}
              </Link>
            </p>
          )}
        </div>

        <div className={cn("w-full", width === "md" ? "max-w-[440px]" : "max-w-[480px]")}>
          {children}
        </div>

        <div className="w-full text-[13px] font-medium leading-[18px] text-ink-muted">
          {footnote}
        </div>
      </main>
    </div>
  );
}

/** Sur-titre en capitales mono (« Étape 1 sur 2 »). */
export function Eyebrow({ children }: { children: ReactNode }) {
  return (
    <p className="font-mono text-label font-semibold uppercase leading-4 tracking-[0.055em] text-neutral">
      {children}
    </p>
  );
}

export function AuthTitle({ children, size = "lg" }: { children: ReactNode; size?: "md" | "lg" }) {
  return (
    <h1
      className={cn(
        "font-headline text-ink",
        size === "lg"
          ? "text-[44px] leading-[42px] sm:text-[56px] sm:leading-[52px]"
          : "text-[40px] leading-[40px] sm:text-[48px] sm:leading-[46px]",
      )}
    >
      {children}
    </h1>
  );
}

export function AuthLead({ children }: { children: ReactNode }) {
  return <p className="text-base font-medium leading-6 text-ink-muted">{children}</p>;
}
