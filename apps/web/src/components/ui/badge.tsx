import type { ReactNode } from "react";
import { Swap } from "@/components/motion/swap";
import { cn } from "@/lib/cn";

export type Tone = "success" | "warning" | "danger" | "info" | "draft" | "ink" | "neutral";

const tones: Record<Tone, string> = {
  success: "bg-success-bg text-success",
  warning: "bg-warning-bg text-warning",
  danger: "bg-danger-bg text-danger",
  info: "bg-info-bg text-info",
  draft: "bg-draft-bg text-draft",
  /** Complet : pilule noire. */
  ink: "bg-ink text-on-ink",
  /** Sans enjeu (« Bientôt », « À venir ») : gris. */
  neutral: "bg-field text-ink-subtle",
};

/**
 * Pastille de statut (DA v4) : pilule teintée, texte 12 px gras. `sm` : 11 px, 20 px de haut
 * (à côté d'un titre, dans un menu).
 */
export function StatusBadge({
  tone,
  size = "md",
  children,
}: {
  tone: Tone;
  size?: "sm" | "md";
  children: ReactNode;
}) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center rounded-full font-bold whitespace-nowrap transition-colors",
        size === "sm" ? "h-5 px-2 text-[11px] leading-[14px]" : "h-6 px-2.5 text-xs leading-4",
        tones[tone],
      )}
    >
      <Swap value={typeof children === "string" ? children : tone}>{children}</Swap>
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
