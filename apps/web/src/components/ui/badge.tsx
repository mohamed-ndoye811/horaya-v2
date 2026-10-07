import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

export type Tone = "success" | "warning" | "danger" | "info" | "draft";

const tones: Record<Tone, { box: string; dot: string }> = {
  success: { box: "border-success bg-success-bg text-success", dot: "bg-success" },
  warning: { box: "border-warning bg-warning-bg text-warning", dot: "bg-warning" },
  danger: { box: "border-danger bg-danger-bg text-danger", dot: "bg-danger" },
  info: { box: "border-info bg-info-bg text-info", dot: "bg-info" },
  draft: { box: "border-draft bg-draft-bg text-draft", dot: "bg-draft" },
};

/** Étiquette de statut : cadre 1,5 px, pastille ronde, texte 13 px gras. */
export function StatusBadge({ tone, children }: { tone: Tone; children: ReactNode }) {
  return (
    <span
      className={cn(
        "inline-flex h-[26px] shrink-0 items-center gap-1.5 border-[1.5px] px-2.5 text-[13px] font-bold leading-4 whitespace-nowrap",
        tones[tone].box,
      )}
    >
      <span aria-hidden="true" className={cn("size-1.5 rounded-dot", tones[tone].dot)} />
      {children}
    </span>
  );
}

/** Compteur en mono (navigation, onglets). */
export function CountBadge({
  children,
  tone = "ink",
}: {
  children: ReactNode;
  tone?: "ink" | "danger";
}) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 px-1.5 py-0.5 font-mono text-label font-semibold leading-4 text-on-ink",
        tone === "danger" ? "bg-danger" : "bg-ink",
      )}
    >
      {children}
    </span>
  );
}
