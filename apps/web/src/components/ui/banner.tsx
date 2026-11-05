import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

const tones = {
  warning: { box: "bg-warning-bg text-warning", mark: "bg-warning" },
  danger: { box: "bg-danger-bg text-danger", mark: "bg-danger" },
  info: { box: "bg-info-bg text-info", mark: "bg-info" },
  success: { box: "bg-success-bg text-success", mark: "bg-success" },
};

/**
 * Bandeau teinté sous l'en-tête de page (« 3 réservations attendent ta validation »),
 * avec une pastille « ! » et une action à droite (sous le texte sur mobile).
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
        "mx-4 flex animate-drop flex-wrap items-center gap-x-4 gap-y-2 rounded-2xl px-4 py-3.5",
        tones[tone].box,
      )}
    >
      <span
        aria-hidden="true"
        className={cn(
          "flex size-6 shrink-0 items-center justify-center rounded-full text-sm font-extrabold leading-4 text-white",
          tones[tone].mark,
        )}
      >
        !
      </span>
      <p className="min-w-0 flex-1 text-[15px] font-semibold leading-5">{children}</p>
      {action && (
        <div className="shrink-0 basis-full pl-10 text-[15px] font-bold leading-5 sm:basis-auto sm:pl-0">
          {action}
        </div>
      )}
    </div>
  );
}
