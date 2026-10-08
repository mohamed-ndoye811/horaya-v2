import { weekdayOf } from "@horaya/core";
import Link from "next/link";
import { type CivilDate, civilKey, groupByDay, isAllDay, monthGrid } from "@/lib/calendar";
import { cn } from "@/lib/cn";
import { textOn } from "@/lib/colors";
import { formatEventRange, formatHour, formatTimeRange, formatWeekdayShort } from "@/lib/format";
import type { CalendarEvent } from "./types";

/*
 * Calendrier sur mobile (maquettes M14 à M16) : grille du mois compacte avec pastilles,
 * bande de la semaine et agenda en liste. Masqués à partir de `lg`, où les grandes vues
 * reprennent la main.
 */

const LETTERS = ["L", "M", "M", "J", "V", "S", "D"];
const WEEKDAYS = ["Lun.", "Mar.", "Mer.", "Jeu.", "Ven.", "Sam.", "Dim."];
const MONTHS = [
  "janvier",
  "février",
  "mars",
  "avril",
  "mai",
  "juin",
  "juillet",
  "août",
  "septembre",
  "octobre",
  "novembre",
  "décembre",
];
const LONG_WEEKDAYS = ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi", "Dimanche"];

/** « Lundi 15 juin » ou « Lun. 15 juin ». */
export function dayLabel(day: CivilDate, short = false): string {
  const weekday = weekdayOf(day.year, day.month, day.day);
  return `${(short ? WEEKDAYS : LONG_WEEKDAYS)[weekday]} ${day.day} ${MONTHS[day.month - 1]}`;
}

/** « Jeu. 14h → Ven. 16h30 » ; « Jeu. → Ven. » pour des journées entières. */
function shortSpan(event: CalendarEvent, timeZone: string): string {
  const start = formatHour(event.startsAt, timeZone);
  const end = formatHour(event.endsAt, timeZone);
  const from = formatWeekdayShort(event.startsAt, timeZone);
  const to = formatWeekdayShort(new Date(event.endsAt.getTime() - 1), timeZone);
  return start === "0h" && end === "0h" ? `${from} → ${to}` : `${from} ${start} → ${to} ${end}`;
}

/** Pastilles des événements d'un jour (3 au plus). */
function Dots({ events, muted = false }: { events: CalendarEvent[]; muted?: boolean }) {
  if (events.length === 0) return null;
  return (
    <span aria-hidden="true" className={cn("flex gap-[3px]", muted && "opacity-50")}>
      {events.slice(0, 3).map((event) => (
        <span key={event.id} className="size-1.5" style={{ backgroundColor: event.color }} />
      ))}
    </span>
  );
}

/** Numéro du jour ; encadré d'encre quand il est sélectionné. */
function DayNumber({ day, selected, muted }: { day: number; selected: boolean; muted: boolean }) {
  return (
    <span
      className={cn(
        "flex h-[22px] min-w-[26px] items-center justify-center px-1 text-sm font-bold leading-[18px]",
        selected ? "bg-ink font-extrabold text-on-ink" : muted ? "text-ink-subtle" : "text-ink",
      )}
    >
      {day}
    </span>
  );
}

/** M14 : le mois en grille compacte ; un jour se touche pour afficher son agenda dessous. */
export function MonthCompact({
  year,
  month,
  events,
  timeZone,
  today,
  selected,
  dayHref,
}: {
  year: number;
  month: number;
  events: CalendarEvent[];
  timeZone: string;
  today: CivilDate;
  selected: CivilDate;
  dayHref: (day: CivilDate) => string;
}) {
  const weeks = monthGrid(year, month);
  const byDay = groupByDay(events, timeZone);
  const todayKey = civilKey(today);
  const selectedKey = civilKey(selected);

  return (
    <div className="border-b-2 border-ink lg:hidden">
      <div aria-hidden="true" className="grid grid-cols-7 border-b border-line-soft">
        {LETTERS.map((letter, index) => (
          <span
            // biome-ignore lint/suspicious/noArrayIndexKey: deux « M » dans la semaine.
            key={index}
            className={cn(
              "py-2 text-center font-mono text-[11px] font-semibold leading-[14px]",
              index >= 5 ? "text-ink-muted" : "text-ink",
            )}
          >
            {letter}
          </span>
        ))}
      </div>
      {weeks.map((week) => (
        <div
          key={civilKey(week[0] ?? today)}
          className="grid grid-cols-7 border-b border-line-soft last:border-b-0"
        >
          {week.map((day, index) => {
            const key = civilKey(day);
            const list = byDay.get(key) ?? [];
            const long = list.filter((event) => isAllDay(event, timeZone));
            const timed = list.filter((event) => !isAllDay(event, timeZone));
            return (
              <Link
                key={key}
                href={dayHref(day)}
                aria-label={`${dayLabel(day)}, ${list.length} événement${list.length > 1 ? "s" : ""}`}
                aria-current={key === selectedKey ? "date" : undefined}
                className={cn(
                  "flex h-[62px] flex-col items-center gap-1.5 border-r border-line-soft pt-1.5 last:border-r-0",
                  key === todayKey ? "bg-today" : index >= 5 && "bg-weekend",
                )}
              >
                <DayNumber day={day.day} selected={key === selectedKey} muted={!day.inMonth} />
                <Dots events={timed} muted={!day.inMonth} />
                <span className="flex-1" />
                {long[0] && (
                  <span
                    aria-hidden="true"
                    className={cn("h-[5px] self-stretch", !day.inMonth && "opacity-50")}
                    style={{ backgroundColor: long[0].color }}
                  />
                )}
              </Link>
            );
          })}
        </div>
      ))}
    </div>
  );
}

/** M15 : bande des 7 jours de la semaine ; un jour mène à sa vue Jour. */
export function WeekStrip({
  days,
  events,
  timeZone,
  today,
  dayHref,
}: {
  days: CivilDate[];
  events: CalendarEvent[];
  timeZone: string;
  today: CivilDate;
  dayHref: (day: CivilDate) => string;
}) {
  const byDay = groupByDay(events, timeZone);
  const todayKey = civilKey(today);
  return (
    <div className="grid grid-cols-7 border-b-2 border-ink lg:hidden">
      {days.map((day, index) => {
        const key = civilKey(day);
        const timed = (byDay.get(key) ?? []).filter((event) => !isAllDay(event, timeZone));
        return (
          <Link
            key={key}
            href={dayHref(day)}
            aria-label={dayLabel(day)}
            className={cn(
              "flex flex-col items-center gap-1 border-r border-line-soft py-2.5 last:border-r-0",
              key === todayKey ? "bg-today" : index >= 5 && "bg-weekend",
            )}
          >
            <span
              className={cn(
                "font-mono text-[10px] font-semibold uppercase leading-[13px] tracking-[0.05em]",
                index >= 5 ? "text-ink-muted" : "text-ink",
              )}
            >
              {WEEKDAYS[index]}
            </span>
            <DayNumber day={day.day} selected={key === todayKey} muted={false} />
            <span className="flex h-1.5 items-center">
              <Dots events={timed} />
            </span>
          </Link>
        );
      })}
    </div>
  );
}

/** Une ligne d'agenda : heure à gauche, carte à filet de couleur (pleine si plusieurs jours). */
function AgendaRow({ event, timeZone }: { event: CalendarEvent; timeZone: string }) {
  const long = isAllDay(event, timeZone);
  const style = long
    ? { backgroundColor: event.color, color: textOn(event.color) }
    : { borderLeftColor: event.color };
  const body = (
    <>
      <span className={cn("truncate text-[15px] font-bold leading-[19px]", !long && "text-ink")}>
        {event.title}
      </span>
      <span
        className={cn(
          "truncate text-[13px] font-medium leading-[17px]",
          long ? "opacity-85" : "text-ink-muted",
        )}
      >
        {long
          ? formatEventRange(event.startsAt, event.endsAt, timeZone)
          : [formatTimeRange(event.startsAt, event.endsAt, timeZone), event.detail]
              .filter(Boolean)
              .join(" · ")}
      </span>
    </>
  );
  const className = cn(
    "flex min-w-0 flex-1 flex-col gap-0.5 px-3 py-2.5",
    long ? "" : "border-l-[3px] bg-surface",
  );
  return (
    <li className="flex items-center gap-3">
      <span
        className={cn(
          "w-12 shrink-0 font-mono font-semibold",
          long ? "text-[11px] uppercase tracking-[0.05em] text-ink-muted" : "text-xs text-ink",
        )}
      >
        {long ? "Jour" : formatHour(event.startsAt, timeZone)}
      </span>
      {event.href ? (
        <Link href={event.href} className={className} style={style}>
          {body}
        </Link>
      ) : (
        <div className={className} style={style}>
          {body}
        </div>
      )}
    </li>
  );
}

/** Événements d'un jour, ceux sur plusieurs jours d'abord. */
function eventsOf(day: CivilDate, events: CalendarEvent[], timeZone: string) {
  const list = groupByDay(events, timeZone).get(civilKey(day)) ?? [];
  return [
    ...list.filter((event) => isAllDay(event, timeZone)),
    ...list.filter((event) => !isAllDay(event, timeZone)),
  ];
}

/** M14 : agenda du jour sélectionné sous la grille du mois. */
export function DayAgenda({
  day,
  events,
  timeZone,
}: {
  day: CivilDate;
  events: CalendarEvent[];
  timeZone: string;
}) {
  const list = eventsOf(day, events, timeZone);
  return (
    <section
      aria-label={`Agenda du ${dayLabel(day)}`}
      className="flex flex-col gap-2.5 px-4 pt-5 lg:hidden"
    >
      <div className="flex items-baseline justify-between gap-3 border-b-2 border-ink pb-2.5">
        <h2 className="font-section text-section uppercase leading-7 text-ink">{dayLabel(day)}</h2>
        <span className="font-mono text-label font-semibold uppercase tracking-[0.055em] text-ink-muted">
          {list.length} événement{list.length > 1 ? "s" : ""}
        </span>
      </div>
      {list.length === 0 ? (
        <p className="py-2 text-sm font-medium text-ink-muted">Rien de prévu ce jour-là.</p>
      ) : (
        <ul className="flex flex-col gap-2.5">
          {list.map((event) => (
            <AgendaRow key={event.id} event={event} timeZone={timeZone} />
          ))}
        </ul>
      )}
    </section>
  );
}

/** M15 : la semaine en agenda groupé par jour, précédé des événements sur plusieurs jours. */
export function WeekAgenda({
  days,
  events,
  timeZone,
  today,
}: {
  days: CivilDate[];
  events: CalendarEvent[];
  timeZone: string;
  today: CivilDate;
}) {
  const long = events.filter((event) => isAllDay(event, timeZone));
  const timed = events.filter((event) => !isAllDay(event, timeZone));
  const todayKey = civilKey(today);
  return (
    <div className="flex flex-col lg:hidden">
      {long.length > 0 && (
        <ul className="flex flex-col gap-1.5 border-b border-line-soft px-4 py-3">
          {long.map((event) => {
            const style = { backgroundColor: event.color, color: textOn(event.color) };
            const content = (
              <>
                <span className="truncate text-[13px] font-bold leading-4">{event.title}</span>
                <span className="shrink-0 font-mono text-[11px] font-medium opacity-85">
                  {shortSpan(event, timeZone)}
                </span>
              </>
            );
            return (
              <li key={event.id}>
                {event.href ? (
                  <Link
                    href={event.href}
                    className="flex h-7 items-center justify-between gap-3 px-2.5"
                    style={style}
                  >
                    {content}
                  </Link>
                ) : (
                  <div className="flex h-7 items-center justify-between gap-3 px-2.5" style={style}>
                    {content}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
      <div className="flex flex-col gap-5 px-4 pt-4">
        {days.map((day) => {
          const list = eventsOf(day, timed, timeZone);
          return (
            <section key={civilKey(day)} aria-label={dayLabel(day)} className="flex flex-col gap-2">
              <h2 className="flex items-center gap-2.5 border-b-2 border-ink pb-2 font-mono text-label font-semibold uppercase tracking-[0.055em] text-ink">
                {dayLabel(day, true)}
                {civilKey(day) === todayKey && (
                  <span className="bg-ink px-1.5 py-0.5 text-[10px] leading-[13px] text-on-ink">
                    Aujourd'hui
                  </span>
                )}
              </h2>
              {list.length === 0 ? (
                <p className="text-sm font-medium text-ink-subtle">Rien de prévu.</p>
              ) : (
                <ul className="flex flex-col gap-2">
                  {list.map((event) => (
                    <AgendaRow key={event.id} event={event} timeZone={timeZone} />
                  ))}
                </ul>
              )}
            </section>
          );
        })}
      </div>
    </div>
  );
}
