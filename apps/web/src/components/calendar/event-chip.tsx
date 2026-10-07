import Link from "next/link";
import type { CSSProperties, ReactNode } from "react";
import { cn } from "@/lib/cn";
import { textOn } from "@/lib/colors";

/**
 * Pastille d'événement de la vue Mois.
 * `filled` (journée entière ou plusieurs jours) : fond de la couleur du type.
 * Sinon : fond clair, filet de 3 px à gauche, heure en mono.
 */
export function EventChip({
  title,
  color,
  time,
  filled = false,
  muted = false,
  href,
}: {
  title: string;
  color: string;
  time?: string;
  filled?: boolean;
  /** Jour hors du mois affiché. */
  muted?: boolean;
  href?: string;
}) {
  const style: CSSProperties = filled
    ? { backgroundColor: color, color: textOn(color) }
    : { borderLeftColor: color };
  const content: ReactNode = (
    <>
      {time && !filled && (
        <span className="shrink-0 font-mono text-[11px] font-semibold leading-[14px] text-ink-muted">
          {time}
        </span>
      )}
      <span
        className={cn(
          "truncate text-label leading-[14px]",
          filled ? "font-bold" : "font-semibold text-ink",
        )}
      >
        {title}
      </span>
    </>
  );
  const className = cn(
    "flex h-[22px] shrink-0 items-center gap-1.5 overflow-hidden",
    filled ? "px-2" : "border-l-[3px] bg-surface px-1.5",
    muted && "opacity-55",
    href && "hover:brightness-95 focus-visible:outline-2 focus-visible:outline-ink",
  );
  return href ? (
    <Link href={href} className={className} style={style} title={title}>
      {content}
    </Link>
  ) : (
    <span className={className} style={style} title={title}>
      {content}
    </span>
  );
}
