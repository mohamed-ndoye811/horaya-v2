import type { ReactNode } from "react";
import { CountUp } from "@/components/motion/count-up";
import { cn } from "@/lib/cn";

/**
 * Indicateurs (tableau de bord, fiche événement) : une carte blanche par chiffre,
 * 2 colonnes sur mobile, 4 sur grand écran.
 */
export function StatGrid({ children }: { children: ReactNode }) {
  return <div className="grid grid-cols-2 gap-3 px-4 xl:grid-cols-4">{children}</div>;
}

interface StatProps {
  label: string;
  value: ReactNode;
  /** Complément après la valeur (« / 50 »). */
  suffix?: ReactNode;
  /** Ligne du bas : tendance, lien, explication, jauge… */
  footer?: ReactNode;
  footerTone?: "success" | "danger" | "muted";
  /** Mise en avant : fond rouge pâle (« À valider ») ou ambre (« À réviser »). */
  highlight?: boolean | "warning";
  /** Carte noire de synthèse (taux de présence pendant le check-in). */
  dark?: boolean;
  /** Pastille à droite du libellé (« Check-in ouvert »). */
  badge?: ReactNode;
}

export function Stat({
  label,
  value,
  suffix,
  footer,
  footerTone = "muted",
  highlight,
  dark = false,
  badge,
}: StatProps) {
  return (
    <div
      className={cn(
        "reveal-group flex min-w-0 flex-col gap-2 rounded-3xl px-4 py-4 sm:px-5 sm:py-5",
        dark
          ? "bg-ink text-on-ink"
          : highlight === "warning"
            ? "bg-warning-bg"
            : highlight
              ? "bg-danger-bg"
              : "bg-surface",
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <p
          className={cn(
            "text-[13px] font-semibold leading-4",
            dark
              ? "text-[#9a9ea8]"
              : highlight === "warning"
                ? "text-warning"
                : highlight
                  ? "text-danger"
                  : "text-ink-muted",
          )}
        >
          {label}
        </p>
        {badge}
      </div>
      <p className="flex items-baseline gap-1.5">
        <span
          className={cn(
            "font-headline text-[34px] leading-9 sm:text-[40px] sm:leading-[44px]",
            dark
              ? "text-white"
              : highlight === "warning"
                ? "text-warning"
                : highlight
                  ? "text-danger"
                  : "text-ink",
          )}
        >
          {typeof value === "string" || typeof value === "number" ? (
            <CountUp value={String(value)} />
          ) : (
            value
          )}
        </span>
        {suffix && (
          <span
            className={cn(
              "text-lg font-light leading-[22px]",
              dark ? "text-[#9a9ea8]" : "text-ink-muted",
            )}
          >
            {suffix}
          </span>
        )}
      </p>
      {footer && (
        <div
          className={cn(
            "text-sm font-semibold leading-[18px]",
            dark
              ? "text-[#9a9ea8]"
              : highlight === "warning"
                ? "text-warning"
                : highlight
                  ? "text-danger"
                  : footerTone === "success"
                    ? "text-success"
                    : footerTone === "danger"
                      ? "text-danger"
                      : "text-ink-muted",
          )}
        >
          {footer}
        </div>
      )}
    </div>
  );
}

/**
 * Chiffre clé compact (DA v4, clients et matériel) : libellé, valeur en Urbanist avec
 * son unité en petit, et un complément à droite (pastille, précision, anneau).
 */
export function MiniStat({
  label,
  value,
  unit,
  aside,
  dark = false,
}: {
  label: string;
  value: ReactNode;
  /** « € », « % » : en petit après la valeur. */
  unit?: ReactNode;
  aside?: ReactNode;
  /** Carte noire de synthèse (« Clients VIP », « Prochaine venue »). */
  dark?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex min-w-0 items-end justify-between gap-3 rounded-[20px] px-5 py-4",
        dark
          ? "bg-ink"
          : "bg-surface shadow-[0_1px_2px_rgba(0,0,0,0.04),0_16px_40px_rgba(0,0,0,0.05)]",
      )}
    >
      <div className="flex min-w-0 flex-col gap-1.5">
        <p className="text-[13px] font-semibold leading-[17px] text-ink-subtle">{label}</p>
        <p
          className={cn(
            "truncate font-headline text-[32px] leading-9 tracking-[-0.03em]",
            dark ? "text-white" : "text-ink",
          )}
        >
          {value}
          {unit && <span className="ml-1 text-base font-light tracking-normal">{unit}</span>}
        </p>
      </div>
      {aside && (
        <div className="shrink-0 text-right text-xs leading-4 text-ink-subtle">{aside}</div>
      )}
    </div>
  );
}

/** Anneau de progression de 44 px (taux de retour, taux de présence). */
export function ProgressRing({ percent }: { percent: number }) {
  const circumference = 2 * Math.PI * 18;
  const filled = (Math.min(100, Math.max(0, percent)) / 100) * circumference;
  return (
    <svg aria-hidden="true" width="44" height="44" viewBox="0 0 44 44" className="-rotate-90">
      <circle cx="22" cy="22" r="18" fill="none" stroke="#ededeb" strokeWidth="4" />
      <circle
        cx="22"
        cy="22"
        r="18"
        fill="none"
        stroke="#111111"
        strokeWidth="4"
        strokeLinecap="round"
        strokeDasharray={`${filled} ${circumference}`}
      />
    </svg>
  );
}
