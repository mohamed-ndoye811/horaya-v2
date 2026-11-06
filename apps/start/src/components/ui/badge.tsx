import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

export type Tone = "success" | "warning" | "danger" | "info" | "draft" | "ink";

const tones: Record<Tone, string> = {
  success: "bg-success-bg text-success",
  warning: "bg-warning-bg text-warning",
  danger: "bg-danger-bg text-danger",
  info: "bg-info-bg text-info",
  draft: "bg-draft-bg text-draft",
  /** Complet : pilule noire. */
  ink: "bg-ink text-on-ink",
};

/** Pastille de statut (DA v4) : pilule teintée, texte 12 px gras. */
export function StatusBadge({ tone, children }: { tone: Tone; children: ReactNode }) {
  return (
    <span
      className={cn(
        "inline-flex h-6 shrink-0 items-center rounded-full px-2.5 text-xs font-bold leading-4 whitespace-nowrap",
        tones[tone],
      )}
    >
      {children}
    </span>
  );
}

/** Compteur en mono (onglets, filtres). */
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
        "inline-flex min-w-5 shrink-0 justify-center rounded-full px-1.5 py-0.5 font-mono text-label font-semibold leading-4 text-on-ink",
        tone === "danger" ? "bg-danger" : "bg-ink",
      )}
    >
      {children}
    </span>
  );
}
