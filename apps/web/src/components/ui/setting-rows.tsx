import { Children, type ComponentProps, Fragment, type ReactNode } from "react";
import { cn } from "@/lib/cn";

/**
 * Réglages groupés (maquettes 9.5 et 9.7) : un cadre à filets, une ligne par réglage avec son
 * titre en gras, une phrase courte et le contrôle à droite.
 */
export function SettingRows({ children }: { children: ReactNode }) {
  const rows = Children.toArray(children).filter(Boolean);
  return (
    <div className="flex flex-col rounded-[14px] border border-bg">
      {rows.map((row, index) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: lignes fixes, dans l'ordre du parent.
        <Fragment key={index}>
          {index > 0 && <div aria-hidden="true" className="mx-3.5 h-px shrink-0 bg-bg" />}
          {row}
        </Fragment>
      ))}
    </div>
  );
}

export function SettingRow({
  title,
  description,
  children,
}: {
  title: ReactNode;
  description?: ReactNode;
  /** Le contrôle, à droite (liste, compteur, interrupteur, champs courts). */
  children: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-center gap-x-3.5 gap-y-2 px-3.5 py-[11px]">
      <div className="flex min-w-[180px] grow basis-0 flex-col gap-px">
        <span className="text-sm font-semibold leading-[18px] text-ink">{title}</span>
        {description && (
          <span className="text-[13px] leading-[17px] text-ink-muted">{description}</span>
        )}
      </div>
      <div className="flex shrink-0 flex-wrap items-center gap-1.5">{children}</div>
    </div>
  );
}

/** Note en une ligne, précédée de l'icône « information » (sous un groupe de réglages). */
export function InfoLine({ children }: { children: ReactNode }) {
  return (
    <p className="flex items-start gap-2 px-0.5 text-label leading-4 text-ink-muted">
      <svg
        width="14"
        height="14"
        viewBox="0 0 24 24"
        aria-hidden="true"
        className="mt-px shrink-0 text-ink-subtle"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      >
        <path d="M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20M12 16v-4M12 8h.01" />
      </svg>
      <span>{children}</span>
    </p>
  );
}

/**
 * Pastille de valeur (32 px, fond gris) : plage horaire, fermeture, bouton « Modifier ».
 * `rounded` : en pilule (avatars des intervenants).
 */
export const pillClasses = (shape: "square" | "rounded" = "square") =>
  cn(
    "flex h-8 shrink-0 items-center gap-1.5 border border-bg bg-field text-[13px] font-semibold leading-4 text-ink",
    shape === "rounded" ? "rounded-full pr-2.5 pl-1" : "rounded-lg px-2.5",
  );

/** Petit champ dans une pastille (« Plein 240 € ») : libellé, saisie, unité. */
export function PillInput({
  label,
  suffix,
  ...props
}: Omit<ComponentProps<"input">, "className"> & { label: string; suffix: string }) {
  return (
    <label className="flex h-[34px] shrink-0 cursor-text items-center gap-1.5 rounded-lg border border-bg bg-field px-2.5 focus-within:border-ink">
      <span className="text-label font-normal text-ink-muted">{label}</span>
      <input
        {...props}
        className="w-12 min-w-0 bg-transparent text-right text-base font-semibold text-ink outline-none lg:text-sm"
      />
      <span className="text-[13px] font-normal text-ink-subtle">{suffix}</span>
    </label>
  );
}
