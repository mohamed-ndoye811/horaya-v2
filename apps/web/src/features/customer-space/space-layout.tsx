import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import { displayFontClass } from "@/lib/fonts";

/**
 * Pièces communes de l'espace client (maquettes 8.1 à 8.5). Les couleurs viennent des jetons :
 * ceux de l'atelier sur ses pages (brandStyle), ceux d'Horaya sur la vue horaya.app.
 */

/** Grand titre (44 px) : police de titres de l'atelier, Urbanist sur la vue horaya.app. */
export function SpaceTitle({
  displayFont,
  children,
}: {
  /** Police choisie par l'atelier ; null sur horaya.app. */
  displayFont: string | null;
  children: ReactNode;
}) {
  return (
    <h1
      className={cn(
        "text-[34px] leading-[38px] tracking-[-0.035em] text-ink sm:text-kpi sm:leading-[48px]",
        displayFont ? displayFontClass(displayFont) : "font-ui font-medium",
      )}
    >
      {children}
    </h1>
  );
}

/** Colonne blanche, formulaire centré (440 px) et panneau sombre à droite (maquettes 8.1, 8.4). */
export function FormShell({ aside, children }: { aside: ReactNode; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-4 lg:min-h-[640px] lg:flex-row">
      <section className="flex flex-1 flex-col items-center justify-center rounded-3xl bg-surface px-6 py-10 sm:p-12">
        <div className="reveal-group flex w-full max-w-[440px] flex-col gap-[22px]">{children}</div>
      </section>
      {aside}
    </div>
  );
}

/**
 * Panneau sombre à droite : sur-titre aux couleurs de l'atelier et une phrase, sur la photo de
 * couverture assombrie (sinon un halo de la couleur de marque). Masqué sur mobile.
 */
export function SpaceAside({
  eyebrow,
  image,
  children,
}: {
  eyebrow: string;
  image?: string | null;
  children: ReactNode;
}) {
  return (
    <aside
      className="hidden w-[400px] shrink-0 flex-col justify-end gap-3 rounded-3xl bg-cover bg-[position:50%_70%] p-8 lg:flex"
      style={{
        backgroundImage: image
          ? `linear-gradient(180deg, color-mix(in srgb, var(--color-ink) 10%, transparent), color-mix(in srgb, var(--color-ink) 85%, transparent)), url("${image}")`
          : "radial-gradient(circle at 70% 15%, color-mix(in srgb, var(--brand) 55%, transparent), transparent 65%), linear-gradient(var(--color-ink), var(--color-ink))",
      }}
    >
      <p className="text-[13px] font-semibold leading-4 text-[var(--brand-light)]">{eyebrow}</p>
      <p className="text-[15px] leading-[23px] text-white">{children}</p>
    </aside>
  );
}
