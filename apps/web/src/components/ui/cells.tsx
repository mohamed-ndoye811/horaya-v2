import Link from "next/link";
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import { formatDayNumber, formatMoney, formatMonthShort, formatWeekdayShort } from "@/lib/format";
import { Avatar, CategorySwatch } from "./avatar";

/** Titre (gras 16 px) + sous-titre (14 px), tronqués sur une ligne. Lien si `href`. */
export function TitleBlock({
  title,
  subtitle,
  href,
  leading,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  href?: string;
  /** Élément avant le titre, sur la même ligne (carré de catégorie). */
  leading?: ReactNode;
}) {
  return (
    <div className="flex min-w-0 flex-1 flex-col gap-1">
      <div className="flex min-w-0 items-center gap-2">
        {leading}
        {href ? (
          <Link
            href={href}
            className="truncate text-base font-bold leading-5 text-ink hover:underline hover:decoration-1 hover:underline-offset-[3px]"
          >
            {title}
          </Link>
        ) : (
          <span className="truncate text-base font-bold leading-5 text-ink">{title}</span>
        )}
      </div>
      {subtitle && (
        <p className="truncate text-sm font-medium leading-[18px] text-ink-muted">{subtitle}</p>
      )}
    </div>
  );
}

/** Personne : avatar + nom + détail (client, membre). */
export function PersonCell({
  name,
  detail,
  href,
  avatarSize = "lg",
  pending,
}: {
  name: string;
  detail?: ReactNode;
  href?: string;
  avatarSize?: "sm" | "md" | "lg";
  pending?: boolean;
}) {
  return (
    <div className="flex min-w-0 items-center gap-3.5">
      <Avatar name={name} size={avatarSize} pending={pending} />
      <TitleBlock title={name} subtitle={detail} href={href} />
    </div>
  );
}

/** Événement : carré de catégorie + titre + infos. */
export function EventCell({
  title,
  color,
  detail,
  href,
}: {
  title: string;
  color: string;
  detail?: ReactNode;
  href?: string;
}) {
  return (
    <TitleBlock
      title={title}
      subtitle={detail}
      href={href}
      leading={<CategorySwatch color={color} />}
    />
  );
}

/** Bloc date des listes : « JUIN » en mono au-dessus de « 20 » (ou jour + mois en dessous). */
export function DateBlock({
  date,
  timeZone,
  layout = "month-first",
}: {
  date: Date;
  timeZone?: string;
  layout?: "month-first" | "day-first";
}) {
  const label = (
    <span className="font-mono text-label font-semibold uppercase leading-[14px] tracking-[0.055em] text-ink-muted">
      {layout === "month-first"
        ? formatMonthShort(date, timeZone)
        : `${formatWeekdayShort(date, timeZone)} ${formatMonthShort(date, timeZone)}`}
    </span>
  );
  const day = (
    <span className="text-[28px] font-extrabold leading-7 text-ink tabular-nums">
      {layout === "day-first"
        ? formatDayNumber(date, timeZone).padStart(2, "0")
        : formatDayNumber(date, timeZone)}
    </span>
  );
  return (
    <time dateTime={date.toISOString()} className="flex w-14 shrink-0 flex-col gap-1">
      {layout === "month-first" ? (
        <>
          {label}
          {day}
        </>
      ) : (
        <>
          {day}
          {label}
        </>
      )}
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
          "font-extrabold leading-5 text-ink tabular-nums",
          size === "lg" ? "text-lg" : "text-base",
        )}
      >
        {formatMoney(cents)}
      </span>
      {caption && (
        <span className="font-mono text-[11px] font-semibold uppercase leading-[14px] tracking-[0.045em] text-ink-muted">
          {caption}
        </span>
      )}
    </div>
  );
}

/** Texte secondaire en capitales mono (« MER. 17 JUIN · 11H »). */
export function MonoCaption({ children }: { children: ReactNode }) {
  return (
    <span className="font-mono text-[11px] font-semibold uppercase leading-[14px] tracking-[0.045em] text-ink-muted">
      {children}
    </span>
  );
}
