import { cn } from "@/lib/cn";
import type { Tone } from "./badge";

const fills: Record<Tone | "ink", string> = {
  ink: "bg-ink",
  success: "bg-success",
  warning: "bg-warning",
  danger: "bg-danger",
  info: "bg-info",
  draft: "bg-draft",
};

/** Jauge fine (4 px) : remplissage d'un événement, progression d'une checklist. */
export function ProgressBar({
  value,
  max,
  tone = "ink",
  label,
  className,
}: {
  value: number;
  max: number;
  tone?: Tone | "ink";
  /** Texte lu par les lecteurs d'écran (« 38 inscrits sur 50 »). */
  label: string;
  className?: string;
}) {
  const percent = max > 0 ? Math.min(100, Math.max(0, (value / max) * 100)) : 0;
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={max}
      aria-valuenow={value}
      className={cn("flex h-1 bg-line-soft", className)}
    >
      <div className={cn("h-1", fills[tone])} style={{ width: `${percent}%` }} />
    </div>
  );
}

/** Ton de la jauge de remplissage : vert, puis ambre à 80 %, bleu quand c'est plein. */
export function fillTone(seatsHeld: number, capacity: number | null): Tone | "ink" {
  if (!capacity) return "success";
  if (seatsHeld >= capacity) return "ink";
  return seatsHeld / capacity >= 0.8 ? "warning" : "success";
}
