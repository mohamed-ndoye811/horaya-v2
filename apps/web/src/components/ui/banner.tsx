import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

const tones = {
  warning: { box: "bg-warning-bg text-warning-strong", mark: "bg-warning" },
  danger: { box: "bg-danger-bg text-danger", mark: "bg-danger" },
  info: { box: "bg-info-bg text-info", mark: "bg-info" },
  success: { box: "bg-success-bg text-success", mark: "bg-success" },
};

/**
 * Bandeau teinté sous l'en-tête de page (DA v4) : pilule avec une pastille, le texte
 * (`<strong>` en gras) et une action en pilule blanche à droite (sous le texte sur mobile).
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
        "mx-4 flex animate-drop flex-wrap items-center gap-x-3 gap-y-2 rounded-3xl py-3 pr-2 pl-4 sm:min-h-11 sm:rounded-full sm:py-1.5",
        tones[tone].box,
      )}
    >
      <span aria-hidden="true" className={cn("size-2 shrink-0 rounded-full", tones[tone].mark)} />
      <p className="min-w-0 flex-1 basis-56 text-sm leading-[18px] [&_strong]:font-bold">
        {children}
      </p>
      {action && (
        <div className="flex h-[30px] shrink-0 items-center rounded-full bg-surface px-3.5 text-meta font-semibold leading-4 text-ink hover:bg-field">
          {action}
        </div>
      )}
    </div>
  );
}
