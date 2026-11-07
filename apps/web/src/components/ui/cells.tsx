import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import { formatDayNumber, formatMoney, formatMonthShort, formatWeekdayShort } from "@/lib/format";
import { Link } from "@/lib/navigation";
import { Avatar, CategorySwatch } from "./avatar";
import { rowLinkClasses } from "./button";
import { TicketIcon } from "./icons";

/** Titre (gras 16 px) + sous-titre (14 px), tronqués sur une ligne. Lien si `href`. */
export function TitleBlock({
  title,
  subtitle,
  href,
  leading,
  stretched = false,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  href?: string;
  /** Élément avant le titre, sur la même ligne (carré de catégorie). */
  leading?: ReactNode;
  /**
   * Le lien couvre tout le premier parent positionné (carte mobile, ligne de liste) :
   * toute la carte se touche. Les autres contrôles de la carte passent en `relative z-10`.
   */
  stretched?: boolean;
}) {
  return (
    <div className="flex min-w-0 flex-1 flex-col gap-px">
      <div className="flex min-w-0 items-center gap-2">
        {leading}
        {href ? (
          <Link
            href={href}
            className={cn(
              rowLinkClasses,
              "truncate text-sm leading-[18px]",
              stretched && "after:absolute after:inset-0",
            )}
          >
            {title}
          </Link>
        ) : (
          <span className="truncate text-sm font-semibold leading-[18px] text-ink">{title}</span>
        )}
      </div>
      {subtitle && <p className="truncate text-xs leading-4 text-ink-subtle">{subtitle}</p>}
    </div>
  );
}

/** Personne : avatar + nom + détail (client, membre). */
export function PersonCell({
  name,
  detail,
  href,
  avatarSize = "row",
  pending,
  stretched,
}: {
  name: string;
  detail?: ReactNode;
  href?: string;
  avatarSize?: "row" | "sm" | "md" | "lg";
  pending?: boolean;
  /** Voir `TitleBlock`. */
  stretched?: boolean;
}) {
  return (
    <div className="flex min-w-0 items-center gap-3">
      <Avatar name={name} size={avatarSize} pending={pending} />
      <TitleBlock title={name} subtitle={detail} href={href} stretched={stretched} />
    </div>
  );
}

/** Événement : carré de catégorie + titre + infos. */
export function EventCell({
  title,
  color,
  detail,
  href,
  stretched,
}: {
  title: string;
  color: string;
  detail?: ReactNode;
  href?: string;
  /** Voir `TitleBlock`. */
  stretched?: boolean;
}) {
  return (
    <TitleBlock
      title={title}
      subtitle={detail}
      href={href}
      stretched={stretched}
      leading={<CategorySwatch color={color} />}
    />
  );
}

/**
 * Vignette d'événement (DA v4) : la photo de couverture, sinon un carré teinté de la couleur
 * du type avec un ticket.
 */
export function EventThumb({
  imageUrl,
  color,
  size = "md",
}: {
  imageUrl?: string | null;
  color: string;
  /** `lg` : 56 px (en-tête de la fiche réservation). */
  size?: "md" | "lg";
}) {
  const box = size === "lg" ? "size-14 rounded-[14px]" : "size-10 rounded-[10px]";
  if (imageUrl) {
    return (
      <span
        aria-hidden="true"
        className={cn("shrink-0 bg-cover bg-center", box)}
        style={{ backgroundImage: `url(${imageUrl})` }}
      />
    );
  }
  return (
    <span
      aria-hidden="true"
      className={cn("flex shrink-0 items-center justify-center text-ink", box)}
      style={{ backgroundColor: `${color}2e` }}
    >
      <TicketIcon size={size === "lg" ? 22 : 17} />
    </span>
  );
}

/** Bloc date des listes : « JUIN » en mono au-dessus de « 20 » (ou jour + mois en dessous). */
export function DateBlock({
  date,
  timeZone,
  layout = "month-first",
  dark = false,
}: {
  date: Date;
  timeZone?: string;
  /** `month-first` : mois au-dessus du jour ; `day-first` : jour de la semaine au-dessus. */
  layout?: "month-first" | "day-first";
  /** Pastille noire : la prochaine venue dans un historique. */
  dark?: boolean;
}) {
  // DA v4 : petite pastille grise, libellé court en capitales et numéro du jour.
  return (
    <time
      dateTime={date.toISOString()}
      className={cn(
        "flex h-[42px] w-10 shrink-0 flex-col items-center justify-center rounded-[10px] whitespace-nowrap",
        dark ? "bg-ink" : "bg-field",
      )}
    >
      <span
        className={cn(
          "text-[11px] font-bold uppercase leading-[13px]",
          dark ? "text-on-ink-muted" : "text-ink-muted",
        )}
      >
        {layout === "month-first"
          ? formatMonthShort(date, timeZone)
          : formatWeekdayShort(date, timeZone)}
      </span>
      <span
        className={cn(
          "text-[15px] font-semibold leading-[18px] tabular-nums",
          dark ? "text-on-ink" : "text-ink",
        )}
      >
        {formatDayNumber(date, timeZone)}
      </span>
    </time>
  );
}

/** Montant + précision en mono (« 240 € » / « CARTE »). */
export function MoneyCell({
  cents,
  caption,
  size = "md",
}: {
  cents: number;
  caption?: string;
  size?: "md" | "lg";
}) {
  return (
    <div className="flex flex-col items-end gap-1">
      <span
        className={cn(
          "font-semibold leading-5 text-ink tabular-nums",
          size === "lg" ? "text-base" : "text-[15px]",
        )}
      >
        {formatMoney(cents)}
      </span>
      {caption && <span className="text-xs leading-4 text-ink-muted">{caption}</span>}
    </div>
  );
}

/** Texte secondaire discret (« mer. 17 juin · 11h »). */
export function MonoCaption({ children }: { children: ReactNode }) {
  return <span className="text-xs leading-4 text-ink-muted">{children}</span>;
}
