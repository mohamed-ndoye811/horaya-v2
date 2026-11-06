import type { DashboardOverview, EventRow, LatestBookingRow, TodayEntry } from "@horaya/db";
import Link from "next/link";
import type { ReactNode } from "react";
import { Avatar } from "@/components/ui/avatar";
import { StatusBadge } from "@/components/ui/badge";
import { BoxIcon, TicketIcon } from "@/components/ui/icons";
import { BOOKING_STATUS_BADGE } from "@/components/ui/status";
import { cn } from "@/lib/cn";
import { meshCover } from "@/lib/cover";
import { elapsed, joinNames, percentChange } from "@/lib/dashboard";
import { todayIn } from "@/lib/dates";
import {
  formatDateTimeShort,
  formatDayNumber,
  formatHour,
  formatMoney,
  formatMonthShort,
} from "@/lib/format";

const plural = (count: number, singular: string, pluralForm = `${singular}s`) =>
  `${count} ${count > 1 ? pluralForm : singular}`;

/* ── À faire ──────────────────────────────────────────────────────────────── */

function TodoCard({
  href,
  dot,
  label,
  aside,
  value,
  children,
  accent = false,
}: {
  href: string;
  dot: string;
  label: string;
  aside?: ReactNode;
  value: number;
  children?: ReactNode;
  /** Carte orange : quelque chose attend vraiment. */
  accent?: boolean;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "flex min-h-[116px] flex-col justify-between gap-3 rounded-[28px] px-[18px] py-4 transition-[scale,box-shadow] hover:shadow-[0_12px_32px_rgba(0,0,0,0.08)] active:scale-[0.99]",
        accent ? "bg-linear-135 from-[#f0975f] to-[#d8723a] text-white" : "bg-surface text-ink",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <span className="flex items-center gap-2 text-[13px] font-semibold leading-[17px]">
          <span aria-hidden="true" className={cn("size-2 rounded-full", dot)} />
          {label}
        </span>
        {aside && (
          <span
            className={cn(
              "text-right text-[13px] font-bold leading-[17px]",
              accent ? "text-white/90" : "text-ink-muted",
            )}
          >
            {aside}
          </span>
        )}
      </div>
      <div className="flex items-end justify-between gap-3">
        <span className="font-headline text-[48px] leading-[44px] tracking-[-0.04em]">{value}</span>
        <div className="flex min-w-0 flex-col items-end gap-1.5 pb-1 text-right">{children}</div>
      </div>
    </Link>
  );
}

export function TodoCards({
  overview,
  now,
  timeZone,
}: {
  overview: DashboardOverview;
  now: Date;
  timeZone: string;
}) {
  const { pending, toCollect, waitlist, drafts } = overview;
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      <TodoCard
        href="/app/reservations?statut=pending"
        dot={pending.count > 0 ? "bg-white" : "bg-info"}
        label="Réservations à valider"
        aside={pending.oldestAt ? `Depuis ${elapsed(pending.oldestAt, now)}` : undefined}
        value={pending.count}
        accent={pending.count > 0}
      >
        {pending.count > 0 ? (
          <>
            <span className="flex -space-x-1.5">
              {pending.people.map((person) => (
                <span key={person.fullName} className="rounded-full ring-2 ring-[#e8843f]">
                  <Avatar name={person.fullName} size="sm" />
                </span>
              ))}
            </span>
            <span className="text-xs leading-4 text-white/85">
              {joinNames(pending.people.map((person) => person.firstName))}
            </span>
          </>
        ) : (
          <span className="text-xs leading-4 text-ink-muted">Tout est à jour</span>
        )}
      </TodoCard>
      <TodoCard
        href="/app/reservations"
        dot="bg-warning"
        label="Paiements à noter"
        aside={
          toCollect.amountCents > 0 ? (
            <span className="text-warning">{formatMoney(toCollect.amountCents)} attendus</span>
          ) : undefined
        }
        value={toCollect.count}
      >
        {toCollect.link > 0 && (
          <span className="rounded-full bg-warning-bg px-2.5 py-1 text-xs font-bold leading-4 text-warning">
            {plural(toCollect.link, "lien")}
          </span>
        )}
        {toCollect.onSite > 0 && (
          <span className="rounded-full bg-warning-bg px-2.5 py-1 text-xs font-bold leading-4 text-warning">
            {toCollect.onSite} sur place
          </span>
        )}
      </TodoCard>
      <TodoCard
        href={waitlist.event ? `/app/evenements/${waitlist.event.id}` : "/app/reservations"}
        dot="bg-info"
        label="En liste d'attente"
        value={waitlist.count}
      >
        {waitlist.event ? (
          <span className="text-xs leading-4 text-ink-muted">
            {waitlist.event.title}
            {waitlist.event.capacity !== null &&
              ` · ${waitlist.event.seatsHeld}/${waitlist.event.capacity}`}
          </span>
        ) : (
          <span className="text-xs leading-4 text-ink-muted">Personne n'attend</span>
        )}
      </TodoCard>
      <TodoCard
        href={drafts.next ? `/app/evenements/${drafts.next.id}` : "/app/evenements?onglet=draft"}
        dot="bg-draft"
        label={drafts.count > 1 ? "Brouillons à publier" : "Brouillon à publier"}
        value={drafts.count}
      >
        {drafts.next ? (
          <span className="flex items-center gap-2.5">
            <span className="max-w-[120px] text-xs leading-4 text-ink-muted">
              {drafts.next.title}
            </span>
            <span className="flex w-10 flex-col items-center rounded-lg border border-line py-1">
              <span className="text-[9px] font-bold uppercase leading-[10px] text-ink-muted">
                {formatMonthShort(drafts.next.startsAt, timeZone)}
              </span>
              <span className="text-base font-semibold leading-5">
                {formatDayNumber(drafts.next.startsAt, timeZone)}
              </span>
            </span>
          </span>
        ) : (
          <span className="text-xs leading-4 text-ink-muted">Rien en attente</span>
        )}
      </TodoCard>
    </div>
  );
}

/* ── Aujourd'hui ──────────────────────────────────────────────────────────── */

function Ring({ value, max, className }: { value: number; max: number; className?: string }) {
  const ratio = max > 0 ? Math.min(1, value / max) : 0;
  const circumference = 2 * Math.PI * 16;
  return (
    <svg width="40" height="40" viewBox="0 0 40 40" aria-hidden="true" className={className}>
      <circle
        cx="20"
        cy="20"
        r="16"
        fill="none"
        stroke="currentColor"
        strokeOpacity="0.15"
        strokeWidth="4"
      />
      {/* À zéro, l'anneau reste vide : un arc nul dessinerait un point. */}
      {ratio > 0 && (
        <circle
          cx="20"
          cy="20"
          r="16"
          fill="none"
          stroke="currentColor"
          strokeWidth="4"
          strokeLinecap="round"
          strokeDasharray={`${ratio * circumference} ${circumference}`}
          transform="rotate(-90 20 20)"
        />
      )}
    </svg>
  );
}

function stateOf(
  entry: TodayEntry,
  now: Date,
): { label: string; tone: "success" | "draft" | "info" } {
  if (entry.kind === "rental") return { label: "Retour matériel", tone: "info" };
  if (now >= entry.startsAt && now < entry.endsAt) return { label: "En cours", tone: "success" };
  if (now >= entry.endsAt) return { label: "Terminé", tone: "draft" };
  return { label: `Dans ${elapsed(now, entry.startsAt)}`, tone: "draft" };
}

export function TodayCard({
  entries,
  now,
  timeZone,
}: {
  entries: TodayEntry[];
  now: Date;
  timeZone: string;
}) {
  if (entries.length === 0) {
    return (
      <div className="flex min-h-[244px] flex-1 flex-col items-center justify-center gap-1 rounded-[28px] bg-surface p-6 text-center">
        <p className="text-[15px] font-semibold text-ink">Rien au programme aujourd'hui.</p>
        <p className="text-[13px] text-ink-muted">Profites-en pour préparer la suite.</p>
      </div>
    );
  }
  return (
    <ol className="reveal-group flex min-h-[244px] flex-1 flex-col rounded-[28px] bg-surface py-1 pr-[22px] pl-5">
      {entries.map((entry, index) => {
        const state = stateOf(entry, now);
        const Icon = entry.kind === "event" ? TicketIcon : BoxIcon;
        const href =
          entry.kind === "event" ? `/app/evenements/${entry.id}` : `/app/reservations/${entry.id}`;
        return (
          <li
            key={`${entry.kind}-${entry.id}`}
            className="relative flex flex-1 items-center gap-3.5 py-3"
          >
            <div className="w-[46px] shrink-0">
              <p className="text-base font-semibold leading-5 text-ink">
                {formatHour(entry.startsAt, timeZone)}
              </p>
              <p className="text-[13px] leading-[17px] text-ink-muted">
                {entry.kind === "event" ? formatHour(entry.endsAt, timeZone) : "retour"}
              </p>
            </div>
            <span
              aria-hidden="true"
              className="-my-3 flex w-3 shrink-0 flex-col items-center self-stretch"
            >
              {/* Trait continu d'une ligne à l'autre, interrompu par le point (maquette 1.1). */}
              <span className={cn("w-0.5 flex-1", index > 0 && "bg-line-soft")} />
              <span
                className={cn(
                  "size-3 shrink-0 rounded-full",
                  state.tone === "success"
                    ? "bg-accent shadow-[0_0_0_4px_rgba(240,151,95,0.22)]"
                    : "border-2 border-[#cfcfcc] bg-surface",
                )}
              />
              <span className={cn("w-0.5 flex-1", index < entries.length - 1 && "bg-line-soft")} />
            </span>
            <span
              aria-hidden="true"
              className="flex size-11 shrink-0 items-center justify-center rounded-[14px] text-ink"
              style={{
                backgroundColor: entry.color ? `${entry.color}33` : "var(--color-info-bg)",
                color: entry.color ?? "var(--color-info)",
              }}
            >
              <Icon size={20} />
            </span>
            <div className="flex min-w-0 flex-1 flex-col gap-1.5">
              <Link
                href={href}
                className="truncate text-base font-semibold leading-5 text-ink after:absolute after:inset-0"
              >
                {entry.title}
              </Link>
              <div className="flex min-w-0 items-center gap-2">
                <StatusBadge tone={state.tone}>{state.label}</StatusBadge>
                <span className="truncate text-[13px] text-ink-muted">
                  {entry.kind === "event" ? entry.locationName : entry.customerName}
                </span>
              </div>
            </div>
            {entry.kind === "event" && (
              <div className="hidden shrink-0 items-center gap-3 sm:flex">
                <div className="text-right">
                  <p className="text-[13px] font-semibold leading-4 text-ink">
                    {entry.checkedIn > 0
                      ? `${entry.checkedIn} ${entry.checkedIn > 1 ? "arrivés" : "arrivé"}`
                      : plural(entry.seatsHeld, "inscrit")}
                  </p>
                  <p className="text-xs leading-4 text-ink-muted">
                    {entry.checkedIn > 0
                      ? `sur ${plural(entry.seatsHeld, "inscrit")}`
                      : entry.capacity !== null
                        ? `sur ${entry.capacity} places`
                        : "places illimitées"}
                  </p>
                </div>
                <Ring
                  value={entry.checkedIn > 0 ? entry.checkedIn : entry.seatsHeld}
                  max={entry.checkedIn > 0 ? entry.seatsHeld : (entry.capacity ?? entry.seatsHeld)}
                  className="text-ink"
                />
              </div>
            )}
          </li>
        );
      })}
    </ol>
  );
}

/* ── 7 prochains jours ────────────────────────────────────────────────────── */

/** Jours calendaires entre aujourd'hui et le début de l'événement (J-3). */
function daysUntil(date: Date, now: Date, timeZone: string) {
  const utc = ({ year, month, day }: { year: number; month: number; day: number }) =>
    Date.UTC(year, month - 1, day);
  return Math.round((utc(todayIn(timeZone, date)) - utc(todayIn(timeZone, now))) / 86_400_000);
}

/** État d'une carte (maquette 1.1) : complet, presque complet, peu rempli à J-3, places restantes. */
function fillState(event: EventRow, now: Date, timeZone: string) {
  if (event.capacity === null) return { label: "Ouvert", tone: "muted" as const };
  const remaining = event.capacity - event.seatsHeld;
  if (remaining <= 0) return { label: "Complet", tone: "full" as const };
  if (remaining <= 2) return { label: "Presque complet", tone: "almost" as const };
  const days = daysUntil(event.startsAt, now, timeZone);
  if (event.seatsHeld / event.capacity < 0.25 && days <= 3) {
    return {
      label: `Peu rempli · ${days > 0 ? `J-${days}` : "aujourd'hui"}`,
      tone: "low" as const,
    };
  }
  return { label: plural(remaining, "place"), tone: "muted" as const };
}

export function NextDaysCards({
  events,
  now,
  timeZone,
}: {
  events: EventRow[];
  now: Date;
  timeZone: string;
}) {
  return (
    <div className="reveal-group grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {events.map((event) => {
        const ratio = event.capacity ? Math.min(1, event.seatsHeld / event.capacity) : 0;
        const state = fillState(event, now, timeZone);
        return (
          <Link
            key={event.id}
            href={`/app/evenements/${event.id}`}
            className="relative flex h-[168px] flex-col justify-between overflow-clip rounded-3xl border-6 border-white bg-white bg-cover bg-center p-3.5 text-white shadow-[0_1px_2px_rgba(0,0,0,0.04),0_16px_40px_rgba(0,0,0,0.1)] transition-transform active:scale-[0.99]"
            style={
              event.coverImageUrl
                ? { backgroundImage: `url(${event.coverImageUrl})` }
                : meshCover(event.typeColor, event.id)
            }
          >
            <span
              aria-hidden="true"
              className="absolute -inset-x-1.5 -bottom-1.5 h-40 bg-linear-to-b from-black/0 via-black/68 via-42% to-black/92"
            />
            <span className="relative flex h-[26px] w-fit items-center rounded-full border border-white/14 bg-black/40 px-2.5 text-xs font-semibold leading-4 backdrop-blur-md">
              {formatDateTimeShort(event.startsAt, timeZone)}
            </span>
            <div className="relative flex flex-col gap-2">
              <p className="truncate text-lg font-semibold leading-[22px]">{event.title}</p>
              <div className="flex items-center justify-between gap-3">
                <span className="text-[13px] leading-[17px] text-white/75">
                  <span className="text-base font-semibold text-white">{event.seatsHeld}</span> /{" "}
                  {event.capacity ?? "∞"}
                </span>
                <span className="h-1 min-w-0 flex-1 rounded-full bg-white/25">
                  <span
                    className={cn(
                      "block h-1 rounded-full",
                      state.tone === "low" ? "bg-[#ff9f80]" : "bg-white",
                    )}
                    style={{ width: `${Math.round(ratio * 100)}%` }}
                  />
                </span>
                <span
                  className={cn(
                    "text-xs leading-4",
                    state.tone === "muted" ? "text-white/75" : "font-semibold",
                    state.tone === "almost" && "text-[#f5c96b]",
                    state.tone === "low" && "text-[#ff9f80]",
                    state.tone === "full" && "text-white",
                  )}
                >
                  {state.label}
                </span>
              </div>
            </div>
          </Link>
        );
      })}
    </div>
  );
}

/* ── Dernières réservations ───────────────────────────────────────────────── */

export function LatestBookings({ bookings, now }: { bookings: LatestBookingRow[]; now: Date }) {
  return (
    <ul className="reveal-group flex flex-col rounded-3xl bg-surface px-5 py-1.5">
      {bookings.map((entry) => {
        const badge = BOOKING_STATUS_BADGE[entry.status];
        return (
          <li
            key={entry.id}
            className="relative flex h-11 items-center gap-4 border-t border-line-soft first:border-t-0"
          >
            <span className="flex w-60 shrink-0 items-center gap-2.5">
              <Avatar name={entry.customerName} size="xs" />
              <Link
                href={`/app/reservations/${entry.id}`}
                className="truncate text-sm font-semibold leading-[18px] text-ink after:absolute after:inset-0"
              >
                {entry.customerName}
              </Link>
            </span>
            <span className="hidden min-w-0 flex-1 truncate text-sm leading-[18px] text-ink-muted md:block">
              {entry.eventTitle ?? "Location"}
            </span>
            <span className="hidden w-20 shrink-0 text-[13px] leading-[17px] text-ink-muted lg:block">
              {plural(entry.seats, "place")}
            </span>
            <span
              className={cn(
                "ml-auto w-[90px] shrink-0 text-right text-sm font-semibold leading-[18px] md:ml-0",
                entry.amountCents > 0 ? "text-ink" : "text-ink-muted",
              )}
            >
              {entry.amountCents > 0 ? formatMoney(entry.amountCents) : "Gratuit"}
            </span>
            <span className="hidden w-[120px] shrink-0 justify-end sm:flex">
              <StatusBadge tone={badge.tone}>{badge.label}</StatusBadge>
            </span>
            <span className="hidden w-[90px] shrink-0 text-right text-[13px] leading-[17px] text-ink-muted lg:block">
              il y a {elapsed(entry.createdAt, now)}
            </span>
          </li>
        );
      })}
    </ul>
  );
}

/* ── Ce mois-ci ───────────────────────────────────────────────────────────── */

function Delta({ value }: { value: number | null }) {
  if (value === null) return null;
  return (
    <span
      className={cn(
        "rounded-full px-2 py-0.5 text-xs font-bold leading-4",
        value >= 0 ? "bg-success/25 text-[#8fd6ac]" : "bg-danger/30 text-[#f2a3a3]",
      )}
    >
      {value > 0 ? "+" : value < 0 ? "−" : ""}
      {Math.abs(value)} %
    </span>
  );
}

/** Le mois jour par jour : une barre par jour passé, un trait pour les jours à venir. */
function MonthDays({ values, today }: { values: number[]; today: number }) {
  const max = Math.max(...values, 1);
  return (
    <span aria-hidden="true" className="flex h-7 items-end gap-[3px]">
      {values.map((value, index) => {
        const day = index + 1;
        return (
          <span
            // biome-ignore lint/suspicious/noArrayIndexKey: un jour du mois, jamais réordonné.
            key={index}
            className={cn(
              "min-h-[2px] flex-1 rounded-[1px]",
              day > today
                ? "bg-white/8"
                : day === today
                  ? "bg-white"
                  : value > 0
                    ? "bg-white/55"
                    : "bg-white/20",
            )}
            style={{ height: day <= today && value > 0 ? `${(value / max) * 100}%` : undefined }}
          />
        );
      })}
    </span>
  );
}

function MonthStat({
  label,
  value,
  suffix,
  delta,
  note,
  chart,
}: {
  label: string;
  value: string;
  suffix?: string;
  delta?: number | null;
  note: string;
  chart?: ReactNode;
}) {
  return (
    <div className="flex min-w-0 flex-1 flex-col gap-1.5 md:border-l md:border-white/10 md:pl-6">
      <p className="flex min-w-0 items-center gap-2 text-[13px] leading-5 text-[#9a9ea8]">
        <span className="shrink-0">{label}</span>
        <Delta value={delta ?? null} />
        <span className="truncate text-xs text-[#6f737c]">{note}</span>
      </p>
      <div className="flex items-end gap-5">
        <p className="shrink-0 font-headline text-[34px] leading-9 text-white">
          {value}
          {suffix && <span className="ml-1 text-lg font-light">{suffix}</span>}
        </p>
        {chart && <div className="min-w-0 flex-1 pb-1.5">{chart}</div>}
      </div>
    </div>
  );
}

/**
 * Bande noire « Ce mois-ci », collée au bas du cadre : ses coins rentrants prolongent le
 * cadre comme le notch (maquette 1.1). Chaque chiffre est comparé à la même date du mois
 * précédent ; les séries couvrent le mois entier, jour par jour.
 */
export function MonthBand({
  period,
  previousMonth,
  today,
  bookingsByDay,
  previousBookings,
  collectedByDay,
  previousCollectedCents,
  fillRate,
}: {
  period: string;
  /** « octobre » */
  previousMonth: string;
  /** Jour du mois (1 à 31). */
  today: number;
  bookingsByDay: number[];
  previousBookings: number;
  collectedByDay: number[];
  previousCollectedCents: number;
  fillRate: number | null;
}) {
  const bookings = bookingsByDay.reduce((sum, value) => sum + value, 0);
  const collectedCents = collectedByDay.reduce((sum, value) => sum + value, 0);
  // « 3 au 6 octobre » : le mois précédent, à la même date.
  const sameDate = `au ${today} ${previousMonth}`;
  return (
    <section
      aria-label="Ce mois-ci"
      className="relative mt-auto flex flex-col gap-5 bg-ink px-5 py-5 md:flex-row md:items-center md:gap-6 lg:-mb-4 lg:px-6"
    >
      <span
        aria-hidden="true"
        className="absolute -top-6 left-0 hidden size-6 bg-[radial-gradient(circle_at_100%_0,transparent_24px,var(--color-ink)_24.5px)] lg:block"
      />
      <span
        aria-hidden="true"
        className="absolute -top-6 right-0 hidden size-6 bg-[radial-gradient(circle_at_0_0,transparent_24px,var(--color-ink)_24.5px)] lg:block"
      />
      <div className="flex shrink-0 flex-col gap-1 md:w-40">
        <p className="font-headline text-xl leading-6 text-white">Ce mois-ci</p>
        <p className="text-xs leading-4 text-[#9a9ea8]">{period}</p>
      </div>
      <MonthStat
        label="Réservations"
        value={String(bookings)}
        delta={percentChange(bookings, previousBookings)}
        note={`${previousBookings} ${sameDate}`}
        chart={<MonthDays values={bookingsByDay} today={today} />}
      />
      <MonthStat
        label="Encaissé"
        value={formatMoney(collectedCents).replace(/\s?€$/, "")}
        suffix="€"
        delta={percentChange(collectedCents, previousCollectedCents)}
        note={`${formatMoney(previousCollectedCents)} ${sameDate}`}
        chart={<MonthDays values={collectedByDay} today={today} />}
      />
      <MonthStat
        label="Remplissage"
        value={fillRate === null ? "—" : String(fillRate)}
        suffix={fillRate === null ? undefined : "%"}
        note={fillRate === null ? "aucune jauge à venir" : "des événements à venir"}
        chart={
          fillRate === null ? undefined : (
            <span
              aria-hidden="true"
              className="block h-1.5 overflow-hidden rounded-full bg-white/15"
            >
              <span
                className="block h-full rounded-full bg-white"
                style={{ width: `${fillRate}%` }}
              />
            </span>
          )
        }
      />
    </section>
  );
}

/** Tableau de bord sur mobile (maquette 6.1) : deux compteurs, le programme du jour, le mois. */
export function MobileSummary({
  pending,
  toCollect,
  today,
  now,
  timeZone,
  month,
}: {
  pending: number;
  toCollect: { count: number; amountCents: number };
  today: TodayEntry[];
  now: Date;
  timeZone: string;
  month: { bookings: number; fillRate: number | null; collectedCents: number };
}) {
  const stat = (href: string, dot: string, label: string, value: ReactNode, detail: string) => (
    <Link
      href={href}
      className="flex min-w-0 flex-1 basis-0 flex-col gap-1.5 rounded-[20px] bg-surface p-3.5"
    >
      <span className="flex items-center gap-1.5 text-xs font-semibold leading-4 text-ink-muted">
        <span aria-hidden="true" className={cn("size-[7px] shrink-0 rounded-full", dot)} />
        {label}
      </span>
      <span className="text-[32px] font-medium leading-[34px] tracking-[-0.03em] text-ink">
        {value}
      </span>
      <span className="truncate text-xs leading-4 text-ink-subtle">{detail}</span>
    </Link>
  );
  const euros = formatMoney(toCollect.amountCents).replace(/\s?€$/, "");
  return (
    <div className="flex flex-col gap-[18px] px-4 lg:hidden">
      <div className="flex gap-2.5">
        {stat(
          "/app/reservations?statut=pending",
          "bg-info",
          "À valider",
          pending,
          `demande${pending > 1 ? "s" : ""} de réservation`,
        )}
        {stat(
          "/app/reservations",
          "bg-warning",
          "À encaisser",
          <>
            {euros} <span className="text-base font-light tracking-normal">€</span>
          </>,
          `${toCollect.count} réservation${toCollect.count > 1 ? "s" : ""}`,
        )}
      </div>

      <section className="flex flex-col overflow-hidden rounded-[22px] bg-surface">
        <h2 className="flex h-11 items-center justify-between bg-band px-4">
          <span className="text-[13px] font-bold leading-4 text-ink">Aujourd'hui</span>
          {today.length > 0 && (
            <span className="text-xs leading-4 text-ink-subtle">{today.length} au programme</span>
          )}
        </h2>
        {today.length === 0 && (
          <p className="border-t border-[#f4f4f2] px-4 py-4 text-sm leading-[18px] text-ink-subtle">
            Rien au programme aujourd'hui.
          </p>
        )}
        {today.map((entry) => {
          const href =
            entry.kind === "event"
              ? `/app/evenements/${entry.id}`
              : `/app/reservations/${entry.id}`;
          const full = entry.capacity !== null && entry.seatsHeld >= entry.capacity;
          return (
            <Link
              key={`${entry.kind}-${entry.id}`}
              href={href}
              className="flex min-h-[62px] items-center gap-3 border-t border-[#f4f4f2] px-4 py-2.5"
            >
              <span className="w-11 shrink-0 font-mono text-xs font-semibold leading-4 text-ink">
                {formatHour(entry.startsAt, timeZone)}
              </span>
              <span
                aria-hidden="true"
                className="h-8 w-[3px] shrink-0 rounded-[2px]"
                style={{ backgroundColor: entry.color ?? "var(--color-info)" }}
              />
              <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className="truncate text-[15px] font-semibold leading-5 text-ink">
                  {entry.title}
                </span>
                <span className="truncate text-xs leading-4 text-ink-subtle">
                  {entry.kind === "event"
                    ? (entry.locationName ?? stateOf(entry, now).label)
                    : `Retour · ${entry.customerName ?? ""}`}
                </span>
              </span>
              {entry.kind === "event" &&
                (full ? (
                  <span className="rounded-full bg-success-bg px-2 py-[3px] text-[11px] font-bold leading-[14px] text-success">
                    Complet
                  </span>
                ) : (
                  <span className="font-mono text-xs font-semibold leading-4 text-ink">
                    {entry.seatsHeld}
                    {entry.capacity !== null && `/${entry.capacity}`}
                  </span>
                ))}
            </Link>
          );
        })}
      </section>

      <section className="flex flex-col gap-3.5 rounded-[22px] bg-ink p-[18px]">
        <h2 className="text-[13px] font-semibold leading-4 text-[#9a9ea8]">Ce mois-ci</h2>
        <dl className="flex justify-between gap-3">
          {[
            [String(month.bookings), "réservations", "text-white"],
            [month.fillRate === null ? "—" : `${month.fillRate} %`, "remplissage", "text-white"],
            [formatMoney(month.collectedCents), "encaissé", "text-accent"],
          ].map(([value, label, color]) => (
            <div key={label} className="flex flex-col-reverse gap-0.5">
              <dt className="text-[11px] leading-[14px] text-ink-subtle">{label}</dt>
              <dd
                className={cn("text-[26px] font-medium leading-[30px] tracking-[-0.03em]", color)}
              >
                {value}
              </dd>
            </div>
          ))}
        </dl>
      </section>
    </div>
  );
}
