import type { ReactNode } from "react";
import { stagger, WordsReveal } from "@/components/motion/words";
import { cn } from "@/lib/cn";

/*
 * Coins de part et d'autre du notch (DA v4, à partir de `xl`) : à gauche « où je suis »,
 * à droite les actions de la page, en boutons de 38 px. Sous `xl`, ils restent dans l'en-tête.
 */
const cornerLeft = "xl:fixed xl:top-[22px] xl:left-[22px] xl:z-40 xl:text-ink";
const cornerRight =
  "xl:fixed xl:top-3 xl:right-[22px] xl:z-40 xl:flex-nowrap " +
  "xl:[&_a]:h-[38px] xl:[&_a]:px-4 xl:[&_a]:text-sm xl:[&_button]:h-[38px] xl:[&_button]:px-4 xl:[&_button]:text-sm";

/**
 * En-tête de page de l'admin (DA v4) : titre en Urbanist, sous-titre gris ; le fil d'Ariane
 * et les actions de la page se posent autour du notch sur grand écran.
 */
export function PageHeader({
  eyebrow,
  title,
  titleAside,
  subtitle,
  actions,
  stickyActions,
  actionsInCorner = true,
  toolbar,
  className,
}: {
  /** Fil d'Ariane ou contexte (« Tableau de bord / Réservations »). */
  eyebrow: ReactNode;
  title: ReactNode;
  /** À côté du titre : badge de statut, flèches de navigation… */
  titleAside?: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
  /**
   * Sur mobile, les actions passent dans une barre collée en bas de l'écran : tout en bas
   * sur les formulaires (`bottom`, sans barre d'onglets), au-dessus des onglets sinon.
   * Ces actions terminent une tâche (enregistrer, valider) : sur grand écran elles restent
   * dans l'en-tête, jamais dans le coin du notch.
   */
  stickyActions?: "bottom" | "above-tabs";
  /** Actions trop larges pour le coin du notch (sélecteur de vue du calendrier) : `false`. */
  actionsInCorner?: boolean;
  /** Recherche et filtres de la liste : à droite du titre sur grand écran, dessous sinon. */
  toolbar?: ReactNode;
  className?: string;
}) {
  return (
    <header
      className={cn(
        "flex flex-col gap-4 px-4 pt-4 pb-5 lg:pt-3 xl:flex-row xl:items-end xl:justify-between xl:gap-8",
        className,
      )}
    >
      <div className="flex min-w-0 flex-col gap-1.5">
        <p className={cn("reveal text-[13px] font-semibold leading-4 text-ink-muted", cornerLeft)}>
          {eyebrow}
        </p>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <h1 className="font-headline text-[34px] leading-[38px] text-ink sm:text-[40px] sm:leading-[44px]">
            <WordsReveal delay={1}>{title}</WordsReveal>
          </h1>
          {titleAside}
        </div>
        {subtitle && (
          <div
            className="reveal text-[15px] font-medium leading-[22px] text-ink-muted"
            style={stagger(3)}
          >
            {subtitle}
          </div>
        )}
      </div>
      {toolbar && (
        <div
          className="reveal flex min-w-0 flex-col gap-3 md:flex-row md:items-center xl:ml-auto xl:shrink-0"
          style={stagger(3)}
        >
          {toolbar}
        </div>
      )}
      {actions &&
        (stickyActions ? (
          <div
            className={cn(
              "fixed inset-x-0 z-30 flex gap-2.5 border-t border-line-soft bg-bg/95 px-4 py-3 backdrop-blur *:flex-1",
              "lg:static lg:z-auto lg:shrink-0 lg:flex-wrap lg:gap-2 lg:border-0 lg:bg-transparent lg:p-0 lg:backdrop-blur-none lg:*:flex-none",
              stickyActions === "bottom"
                ? "bottom-0 pb-[calc(12px+env(safe-area-inset-bottom))]"
                : "bottom-[calc(64px+env(safe-area-inset-bottom))]",
            )}
          >
            {actions}
          </div>
        ) : (
          <div
            className={cn("reveal flex shrink-0 flex-wrap gap-2", actionsInCorner && cornerRight)}
            style={stagger(4)}
          >
            {actions}
          </div>
        ))}
    </header>
  );
}

/** Fil d'Ariane : segments séparés par « / ». */
export function Breadcrumb({ items }: { items: string[] }) {
  return <>{items.join(" / ")}</>;
}
