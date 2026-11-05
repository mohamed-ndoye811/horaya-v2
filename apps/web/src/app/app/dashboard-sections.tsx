import type { DashboardOverview, EventRow, LatestBookingRow, TodayEntry } from "@horaya/db";
import Link from "next/link";
import type { ReactNode } from "react";
import { Avatar } from "@/components/ui/avatar";
import { StatusBadge } from "@/components/ui/badge";
import { BoxIcon, TicketIcon } from "@/components/ui/icons";
import { BOOKING_STATUS_BADGE } from "@/components/ui/status";
import { cn } from "@/lib/cn";
import { elapsed, joinNames, sparklinePoints } from "@/lib/dashboard";
import {
  formatDayNumber,
  formatHour,
  formatMoney,
  formatMonthShort,
  formatWeekdayShort,
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
        "flex min-h-[124px] flex-col justify-between gap-3 rounded-3xl p-4 transition-[scale,box-shadow] hover:shadow-[0_12px_32px_rgba(0,0,0,0.08)] active:scale-[0.99]",
        accent ? "bg-linear-135 from-[#f0975f] to-[#d8723a] text-white" : "bg-surface text-ink",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <span className="flex items-center gap-2 text-[13px] font-semibold leading-4">
          <span aria-hidden="true" className={cn("size-[7px] rounded-full", dot)} />
          {label}
        </span>
        {aside && (
          <span
            className={cn(
              "text-right text-[13px] font-semibold leading-4",
              accent ? "text-white/90" : "text-ink-muted",
            )}
          >
            {aside}
          </span>
        )}
      </div>
      <div className="flex items-end justify-between gap-3">
        <span className="font-headline text-[44px] leading-[44px]">{value}</span>
        <div className="flex min-w-0 flex-col items-end gap-1.5 text-right">{children}</div>
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
  const circumference = 2 * Math.PI * 15;
  return (
    <svg width="38" height="38" viewBox="0 0 38 38" aria-hidden="true" className={className}>
      <circle
        cx="19"
        cy="19"
        r="15"
        fill="none"
        stroke="currentColor"
        strokeOpacity="0.15"
        strokeWidth="3.5"
      />
      <circle
        cx="19"
        cy="19"
        r="15"
        fill="none"
        stroke="currentColor"
        strokeWidth="3.5"
        strokeLinecap="round"
        strokeDasharray={`${ratio * circumference} ${circumference}`}
        transform="rotate(-90 19 19)"
      />
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
      <div className="flex min-h-[260px] flex-col items-center justify-center gap-1 rounded-3xl bg-surface p-6 text-center">
        <p className="text-[15px] font-semibold text-ink">Rien au programme aujourd'hui.</p>
        <p className="text-[13px] text-ink-muted">Profites-en pour préparer la suite.</p>
      </div>
    );
  }
  return (
    <ol className="reveal-group flex flex-col rounded-3xl bg-surface px-5 py-2">
      {entries.map((entry, index) => {
        const state = stateOf(entry, now);
        const Icon = entry.kind === "event" ? TicketIcon : BoxIcon;
        const href =
          entry.kind === "event" ? `/app/evenements/${entry.id}` : `/app/reservations/${entry.id}`;
        return (
          <li key={`${entry.kind}-${entry.id}`} className="relative flex items-center gap-4 py-3">
            <div className="w-12 shrink-0">
              <p className="text-[15px] font-semibold leading-5 text-ink">
                {formatHour(entry.startsAt, timeZone)}
              </p>
              <p className="text-xs leading-4 text-ink-muted">
                {entry.kind === "event" ? formatHour(entry.endsAt, timeZone) : "retour"}
              </p>
            </div>
            <span
              aria-hidden="true"
              className="relative flex w-3 shrink-0 justify-center self-stretch"
            >
              {index < entries.length - 1 && (
                <span className="absolute top-1/2 h-full w-px bg-line" />
              )}
              <span
                className={cn(
                  "relative mt-auto mb-auto size-3 rounded-full border-2",
                  state.tone === "success" ? "border-accent bg-accent" : "border-line bg-surface",
                )}
              />
            </span>
            <span
              aria-hidden="true"
              className="flex size-10 shrink-0 items-center justify-center rounded-xl text-ink"
              style={{
                backgroundColor: entry.color ? `${entry.color}33` : "var(--color-info-bg)",
              }}
            >
              <Icon size={18} />
            </span>
            <div className="flex min-w-0 flex-1 flex-col gap-1">
              <Link
                href={href}
                className="truncate text-[15px] font-semibold leading-5 text-ink after:absolute after:inset-0"
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

export function NextDaysCards({ events, timeZone }: { events: EventRow[]; timeZone: string }) {
  return (
    <div className="reveal-group grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {events.map((event) => {
        const full = event.capacity !== null && event.seatsHeld >= event.capacity;
        const ratio = event.capacity ? Math.min(1, event.seatsHeld / event.capacity) : 0;
        const remaining = event.capacity === null ? null : event.capacity - event.seatsHeld;
        return (
          <Link
            key={event.id}
            href={`/app/evenements/${event.id}`}
            className="flex h-40 flex-col justify-between rounded-[22px] p-3.5 text-white transition-transform active:scale-[0.99]"
            style={{
              background: `linear-gradient(160deg, ${event.typeColor} 0%, #1a1a1a 110%)`,
            }}
          >
            <span className="w-fit rounded-full bg-black/35 px-2.5 py-1 text-xs font-semibold leading-4">
              {formatWeekdayShort(event.startsAt, timeZone)}{" "}
              {formatDayNumber(event.startsAt, timeZone)}{" "}
              {formatMonthShort(event.startsAt, timeZone).toLowerCase()} ·{" "}
              {formatHour(event.startsAt, timeZone)}
            </span>
            <div className="flex flex-col gap-2">
              <p className="truncate text-lg font-semibold leading-[22px]">{event.title}</p>
              <div className="flex items-center gap-2.5">
                <span className="text-[13px] font-semibold leading-4">
                  {event.seatsHeld}
                  <span className="font-normal text-white/70"> / {event.capacity ?? "∞"}</span>
                </span>
                <span className="h-1 flex-1 rounded-full bg-white/25">
                  <span
                    className="block h-1 rounded-full bg-white"
                    style={{ width: `${ratio * 100}%` }}
                  />
                </span>
                <span className="text-xs font-semibold leading-4 text-white/85">
                  {full
                    ? "Complet"
                    : remaining !== null && remaining <= 2
                      ? "Presque complet"
                      : remaining !== null
                        ? plural(remaining, "place")
                        : "Ouvert"}
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
    <ul className="reveal-group flex flex-col rounded-3xl bg-surface px-5">
      {bookings.map((entry) => {
        const badge = BOOKING_STATUS_BADGE[entry.status];
        return (
          <li
            key={entry.id}
            className="relative flex items-center gap-4 border-t border-line-soft py-3 first:border-t-0"
          >
            <Avatar name={entry.customerName} size="sm" />
            <Link
              href={`/app/reservations/${entry.id}`}
              className="w-40 shrink-0 truncate text-sm font-semibold text-ink after:absolute after:inset-0"
            >
              {entry.customerName}
            </Link>
            <span className="hidden min-w-0 flex-1 truncate text-sm text-ink-muted md:block">
              {entry.eventTitle ?? "Location"}
            </span>
            <span className="hidden w-20 shrink-0 text-sm text-ink-muted lg:block">
              {plural(entry.seats, "place")}
            </span>
            <span className="ml-auto w-20 shrink-0 text-right text-sm font-semibold text-ink md:ml-0">
              {entry.amountCents > 0 ? formatMoney(entry.amountCents) : "Gratuit"}
            </span>
            <span className="hidden w-28 shrink-0 justify-end sm:flex">
              <StatusBadge tone={badge.tone}>{badge.label}</StatusBadge>
            </span>
            <span className="hidden w-24 shrink-0 text-right text-[13px] text-ink-muted lg:block">
              il y a {elapsed(entry.createdAt, now)}
            </span>
          </li>
        );
      })}
    </ul>
  );
}

/* ── Ce mois-ci ───────────────────────────────────────────────────────────── */

function Delta({ value, unit = "%" }: { value: number | null; unit?: string }) {
  if (value === null) return null;
  return (
    <span
      className={cn(
        "rounded-full px-2 py-0.5 text-xs font-bold leading-4",
        value >= 0 ? "bg-success/25 text-[#8fd6ac]" : "bg-danger/30 text-[#f2a3a3]",
      )}
    >
      {value > 0 ? "+" : value < 0 ? "−" : ""}
      {Math.abs(value)} {unit}
    </span>
  );
}

function MonthStat({
  label,
  delta,
  deltaUnit,
  value,
  suffix,
  chart,
}: {
  label: string;
  delta: number | null;
  deltaUnit?: string;
  value: string;
  suffix?: string;
  chart: ReactNode;
}) {
  return (
    <div className="flex min-w-0 flex-1 items-end justify-between gap-4 md:border-l md:border-white/10 md:pl-6">
      <div className="flex flex-col gap-1.5">
        <p className="flex items-center gap-2 text-[13px] leading-4 text-[#9a9ea8]">
          {label}
          <Delta value={delta} unit={deltaUnit} />
        </p>
        <p className="font-headline text-[34px] leading-9 text-white">
          {value}
          {suffix && <span className="ml-1 text-lg font-light">{suffix}</span>}
        </p>
      </div>
      {chart}
    </div>
  );
}

/**
 * Bande noire « Ce mois-ci », collée au bas du cadre : ses coins rentrants prolongent le
 * cadre comme le notch (maquette 1.1).
 */
export function MonthBand({
  period,
  bookings,
  bookingsDelta,
  bookingsCurve,
  collectedCents,
  collectedDelta,
  collectedBars,
  fillRate,
}: {
  period: string;
  bookings: number;
  bookingsDelta: number | null;
  bookingsCurve: number[];
  collectedCents: number;
  collectedDelta: number | null;
  collectedBars: number[];
  fillRate: number | null;
}) {
  const maxBar = Math.max(...collectedBars, 1);
  const bars = collectedBars.slice(-14);
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
      <div className="flex shrink-0 flex-col gap-1 md:w-48">
        <p className="font-headline text-xl leading-6 text-white">Ce mois-ci</p>
        <p className="text-xs leading-4 text-[#9a9ea8]">{period}</p>
      </div>
      <MonthStat
        label="Réservations"
        delta={bookingsDelta}
        value={String(bookings)}
        chart={
          <svg
            width="96"
            height="32"
            viewBox="-2 -2 100 36"
            aria-hidden="true"
            className="shrink-0"
          >
            <polyline
              points={sparklinePoints(bookingsCurve, 96, 32)}
              fill="none"
              stroke="white"
              strokeWidth="1.6"
              strokeLinejoin="round"
              strokeLinecap="round"
            />
          </svg>
        }
      />
      <MonthStat
        label="Encaissé"
        delta={collectedDelta}
        value={formatMoney(collectedCents).replace(/\s?€$/, "")}
        suffix="€"
        chart={
          <span aria-hidden="true" className="flex h-8 shrink-0 items-end gap-[3px]">
            {bars.map((value, index) => (
              <span
                // biome-ignore lint/suspicious/noArrayIndexKey: barres d'une série fixe, jamais réordonnées.
                key={index}
                className={cn(
                  "w-[3px] rounded-full",
                  index === bars.length - 1 ? "bg-white" : "bg-white/40",
                )}
                style={{ height: `${Math.max(8, (value / maxBar) * 100)}%` }}
              />
            ))}
          </span>
        }
      />
      <MonthStat
        label="Remplissage"
        delta={null}
        value={fillRate === null ? "—" : String(fillRate)}
        suffix={fillRate === null ? undefined : "%"}
        chart={<Ring value={fillRate ?? 0} max={100} className="shrink-0 text-white" />}
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
