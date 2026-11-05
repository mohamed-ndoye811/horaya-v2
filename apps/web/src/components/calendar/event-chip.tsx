import Link from "next/link";
import type { CSSProperties, ReactNode } from "react";
import { cn } from "@/lib/cn";
import { shadeOf, tintOf } from "@/lib/colors";

/**
 * Pastille d'événement de la vue Mois.
 * Fond pâle de la couleur du type, filet de 3 px à gauche, heure foncée.
 * `filled` (journée entière ou plusieurs jours) : titre en gras, sans heure.
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
  const style: CSSProperties = {
    borderLeftColor: color,
    backgroundColor: tintOf(color),
    color: shadeOf(color),
  };
  const content: ReactNode = (
    <>
      {time && !filled && (
        <span className="shrink-0 text-[11px] font-semibold leading-[14px]">{time}</span>
      )}
      <span
        className={cn(
          "truncate text-label leading-[14px]",
          filled ? "font-bold text-ink" : "font-semibold text-ink",
        )}
      >
        {title}
      </span>
    </>
  );
  const className = cn(
    "flex h-[22px] shrink-0 items-center gap-1.5 overflow-hidden rounded-md",
    "border-l-[3px] px-1.5",
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
