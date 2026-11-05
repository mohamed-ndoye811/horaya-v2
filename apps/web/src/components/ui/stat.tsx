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
}

export function Stat({ label, value, suffix, footer, footerTone = "muted", highlight }: StatProps) {
  return (
    <div
      className={cn(
        "reveal-group flex min-w-0 flex-col gap-2 rounded-3xl px-4 py-4 sm:px-5 sm:py-5",
        highlight === "warning" ? "bg-warning-bg" : highlight ? "bg-danger-bg" : "bg-surface",
      )}
    >
      <p
        className={cn(
          "text-[13px] font-semibold leading-4",
          highlight === "warning" ? "text-warning" : highlight ? "text-danger" : "text-ink-muted",
        )}
      >
        {label}
      </p>
      <p className="flex items-baseline gap-1.5">
        <span
          className={cn(
            "font-headline text-[34px] leading-9 sm:text-[40px] sm:leading-[44px]",
            highlight === "warning" ? "text-warning" : highlight ? "text-danger" : "text-ink",
          )}
        >
          {typeof value === "string" || typeof value === "number" ? (
            <CountUp value={String(value)} />
          ) : (
            value
          )}
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
