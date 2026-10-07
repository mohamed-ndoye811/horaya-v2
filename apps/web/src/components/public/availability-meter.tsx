import { cn } from "@/lib/cn";
import type { AvailabilityTone } from "@/lib/public-booking";

const tones: Record<AvailabilityTone, { text: string; bar: string }> = {
  success: { text: "text-success", bar: "bg-success" },
  warning: { text: "text-warning", bar: "bg-warning" },
  info: { text: "text-info", bar: "bg-info" },
};

/** « Plus que 12 places » et sa jauge (écrans 27 et 10). */
export function AvailabilityMeter({
  label,
  tone,
  ratio,
  count,
  thick = false,
}: {
  label: string;
  tone: AvailabilityTone;
  ratio: number | null;
  /** « 38 / 50 » à droite du libellé (fiche événement). */
  count?: string;
  thick?: boolean;
}) {
  return (
    <div className="flex w-full flex-col gap-2">
      <div className="flex items-baseline justify-between gap-3">
        <span className={cn("text-sm font-bold leading-[18px]", tones[tone].text)}>{label}</span>
        {count && (
          <span className="font-mono text-label font-semibold text-ink-muted">{count}</span>
        )}
      </div>
      {ratio !== null && (
        <span aria-hidden="true" className={cn("flex bg-line-soft", thick ? "h-1.5" : "h-1")}>
          <span className={tones[tone].bar} style={{ width: `${Math.round(ratio * 100)}%` }} />
        </span>
      )}
    </div>
  );
}
