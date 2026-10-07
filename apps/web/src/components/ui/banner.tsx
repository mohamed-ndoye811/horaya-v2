import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

const tones = {
  warning: { box: "bg-warning-bg text-warning", mark: "bg-warning" },
  danger: { box: "bg-danger-bg text-danger", mark: "bg-danger" },
  info: { box: "bg-info-bg text-info", mark: "bg-info" },
  success: { box: "bg-success-bg text-success", mark: "bg-success" },
};

/**
 * Bandeau pleine largeur sous l'en-tête de page (« 3 réservations attendent ta validation »),
 * avec un carré « ! » et une action à droite.
 */
export function Banner({
  tone = "warning",
  action,
  children,
}: {
  tone?: keyof typeof tones;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div
      role={tone === "danger" ? "alert" : "status"}
      className={cn(
        "flex flex-wrap items-center gap-x-4 gap-y-2 border-b-2 border-ink px-4 py-4 sm:px-10",
        tones[tone].box,
      )}
    >
      <span
        aria-hidden="true"
        className={cn(
          "flex size-7 shrink-0 items-center justify-center text-base font-extrabold leading-4 text-white",
          tones[tone].mark,
        )}
      >
        !
      </span>
      <p className="min-w-0 flex-1 text-[15px] font-semibold leading-5">{children}</p>
      {action && <div className="shrink-0 text-[15px] font-bold leading-5">{action}</div>}
    </div>
  );
}
