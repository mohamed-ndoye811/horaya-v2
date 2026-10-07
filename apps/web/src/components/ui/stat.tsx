import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

/**
 * Bandeau d'indicateurs (tableau de bord, fiche événement). Les filets de 2 px sont
 * l'espace entre les cases, sur fond encre : 2 colonnes sur mobile, 4 sur grand écran.
 */
export function StatGrid({ children }: { children: ReactNode }) {
  return (
    <div className="grid grid-cols-2 gap-0.5 border-b-2 border-ink bg-ink xl:grid-cols-4">
      {children}
    </div>
  );
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
}

export function Stat({ label, value, suffix, footer, footerTone = "muted", highlight }: StatProps) {
  return (
    <div
      className={cn(
        "flex min-w-0 flex-col gap-2.5 px-4 py-5 sm:px-10 sm:py-6",
        highlight === "warning" ? "bg-warning-bg" : highlight ? "bg-danger-bg" : "bg-bg",
      )}
    >
      <p
        className={cn(
          "font-mono text-label font-semibold uppercase leading-4 tracking-[0.055em]",
          highlight === "warning" ? "text-warning" : highlight ? "text-danger" : "text-neutral",
        )}
      >
        {label}
      </p>
      <p className="flex items-baseline gap-1.5">
        <span
          className={cn(
            "font-headline text-[36px] leading-9 normal-case sm:text-kpi sm:leading-[44px]",
            highlight === "warning" ? "text-warning" : highlight ? "text-danger" : "text-ink",
          )}
        >
          {value}
        </span>
        {suffix && (
          <span className="text-lg font-bold leading-[22px] text-ink-muted">{suffix}</span>
        )}
      </p>
      {footer && (
        <div
          className={cn(
            "text-sm font-semibold leading-[18px]",
            highlight === "warning"
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
