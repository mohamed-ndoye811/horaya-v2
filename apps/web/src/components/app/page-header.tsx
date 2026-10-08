import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

/**
 * En-tête de page de l'admin : fil d'Ariane mono, grand titre, sous-titre et actions,
 * souligné d'un filet encre de 2 px.
 */
export function PageHeader({
  eyebrow,
  title,
  titleAside,
  subtitle,
  actions,
  stickyActions,
  className,
}: {
  /** Fil d'Ariane ou contexte (« TABLEAU DE BORD / RÉSERVATIONS »). */
  eyebrow: ReactNode;
  title: ReactNode;
  /** À côté du titre : badge de statut, flèches de navigation… */
  titleAside?: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
  /**
   * Sur mobile, les actions passent dans une barre collée en bas de l'écran : tout en bas
   * sur les formulaires (`bottom`, sans barre d'onglets), au-dessus des onglets sinon.
   */
  stickyActions?: "bottom" | "above-tabs";
  className?: string;
}) {
  return (
    <header
      className={cn(
        "flex flex-col gap-6 border-b-2 border-ink px-4 pt-6 pb-6 sm:px-10 sm:pt-8 sm:pb-7 xl:flex-row xl:items-end xl:justify-between xl:gap-8",
        className,
      )}
    >
      <div className="flex min-w-0 flex-col gap-3.5">
        <p className="font-mono text-label font-semibold uppercase leading-4 tracking-[0.055em] text-neutral">
          {eyebrow}
        </p>
        <div className="flex flex-wrap items-center gap-x-5 gap-y-3">
          <h1 className="font-headline text-[44px] leading-[42px] text-ink sm:text-display sm:leading-[60px]">
            {title}
          </h1>
          {titleAside}
        </div>
        {subtitle && (
          <div className="text-base font-medium leading-[22px] text-ink-muted">{subtitle}</div>
        )}
      </div>
      {actions &&
        (stickyActions ? (
          <div
            className={cn(
              "fixed inset-x-0 z-30 flex gap-2.5 border-t-2 border-ink bg-bg px-5 py-3 *:flex-1",
              "lg:static lg:z-auto lg:shrink-0 lg:flex-wrap lg:gap-3 lg:border-0 lg:bg-transparent lg:p-0 lg:*:flex-none",
              stickyActions === "bottom"
                ? "bottom-0 pb-[calc(12px+env(safe-area-inset-bottom))]"
                : "bottom-[calc(64px+env(safe-area-inset-bottom))]",
            )}
          >
            {actions}
          </div>
        ) : (
          <div className="flex shrink-0 flex-wrap gap-3">{actions}</div>
        ))}
    </header>
  );
}

/** Fil d'Ariane du sur-titre : segments séparés par « / ». */
export function Breadcrumb({ items }: { items: string[] }) {
  return <>{items.join(" / ")}</>;
}
