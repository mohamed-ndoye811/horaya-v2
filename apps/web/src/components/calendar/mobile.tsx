import { weekdayOf } from "@horaya/core";
import { ProgramCard, ProgramRow } from "@/components/app/program-card";
import { type CivilDate, civilKey, groupByDay, isAllDay, monthGrid } from "@/lib/calendar";
import { cn } from "@/lib/cn";
import { formatEventRange, formatHour, formatTimeRange, formatWeekdayShort } from "@/lib/format";
import { Link } from "@/lib/navigation";
import { calendarCard } from "./time-grid";
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
        <span
          key={event.id}
          className="size-1.5 rounded-full"
          style={{ backgroundColor: event.color }}
        />
      ))}
    </span>
  );
}

/** Numéro du jour, comme le mois sur ordi : rond d'encre s'il est sélectionné, cerclé si c'est aujourd'hui. */
function DayNumber({
  day,
  selected,
  muted,
  today = false,
}: {
  day: number;
  selected: boolean;
  muted: boolean;
  today?: boolean;
}) {
  return (
    <span
      className={cn(
        "flex size-[26px] items-center justify-center rounded-full text-sm font-bold leading-[18px]",
        selected
          ? "bg-ink text-on-ink"
          : today
            ? "text-ink ring-[1.5px] ring-ink"
            : muted
              ? "text-ink-subtle"
              : "text-ink",
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
    // La même carte que le mois sur ordi (MonthCalendar), en compact.
    <div className={cn(calendarCard, "lg:hidden")}>
      <div aria-hidden="true" className="grid grid-cols-7 border-b border-line-soft">
        {LETTERS.map((letter, index) => (
          <span
            // biome-ignore lint/suspicious/noArrayIndexKey: deux « M » dans la semaine.
            key={index}
            className={cn(
              "py-2.5 text-center text-xs font-semibold uppercase leading-4 text-ink-subtle",
              index >= 5 && "bg-band",
            )}
          >
            {letter}
          </span>
        ))}
      </div>
      {weeks.map((week) => (
        <div
          key={civilKey(week[0] ?? today)}
          className="grid grid-cols-7 border-b border-line-faint last:border-b-0"
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
                  "flex h-[62px] flex-col items-center gap-1 border-r border-line-faint pt-1.5 last:border-r-0",
                  index >= 5 && "bg-band",
                )}
              >
                <DayNumber
                  day={day.day}
                  selected={key === selectedKey}
                  today={key === todayKey}
                  muted={!day.inMonth}
                />
                <Dots events={timed} muted={!day.inMonth} />
                <span className="flex-1" />
                {long[0] && (
                  <span
                    aria-hidden="true"
                    className={cn(
                      "mx-1 mb-1 h-[5px] self-stretch rounded-full",
                      !day.inMonth && "opacity-50",
                    )}
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
    <div className={cn(calendarCard, "grid grid-cols-7 lg:hidden")}>
      {days.map((day, index) => {
        const key = civilKey(day);
        const timed = (byDay.get(key) ?? []).filter((event) => !isAllDay(event, timeZone));
        return (
          <Link
            key={key}
            href={dayHref(day)}
            aria-label={dayLabel(day)}
            className={cn(
              "flex flex-col items-center gap-1 border-r border-line-faint py-2.5 last:border-r-0",
              index >= 5 && "bg-band",
            )}
          >
            <span className={cn("text-xs font-semibold uppercase leading-4 text-ink-subtle")}>
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

/** Une ligne d'agenda dans le style des cartes de programme : « Jour » pour plusieurs jours. */
function AgendaRow({ event, timeZone }: { event: CalendarEvent; timeZone: string }) {
  const long = isAllDay(event, timeZone);
  return (
    <ProgramRow
      href={event.href}
      time={long ? "Jour" : formatHour(event.startsAt, timeZone)}
      color={event.color}
      title={event.title}
      detail={
        long
          ? formatEventRange(event.startsAt, event.endsAt, timeZone)
          : [formatTimeRange(event.startsAt, event.endsAt, timeZone), event.detail]
              .filter(Boolean)
              .join(" · ")
      }
    />
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

const countLabel = (count: number) => `${count} événement${count > 1 ? "s" : ""}`;

/** M14 : agenda du jour sélectionné sous la grille du mois, en carte de programme. */
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
    <div className="px-4 pt-4 lg:hidden">
      <ProgramCard
        title={dayLabel(day)}
        count={list.length > 0 ? countLabel(list.length) : undefined}
        empty={list.length === 0 ? "Rien de prévu ce jour-là." : undefined}
      >
        {list.map((event) => (
          <AgendaRow key={event.id} event={event} timeZone={timeZone} />
        ))}
      </ProgramCard>
    </div>
  );
}

/** M15 : la semaine en cartes de programme, une par jour, après les événements sur plusieurs jours. */
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
    <div className="flex flex-col gap-3 px-4 pt-4 lg:hidden">
      {long.length > 0 && (
        <ProgramCard title="Sur plusieurs jours" count={countLabel(long.length)}>
          {long.map((event) => (
            <ProgramRow
              key={event.id}
              href={event.href}
              time="Jour"
              color={event.color}
              title={event.title}
              detail={shortSpan(event, timeZone)}
            />
          ))}
        </ProgramCard>
      )}
      {days.map((day) => {
        const list = eventsOf(day, timed, timeZone);
        return (
          <ProgramCard
            key={civilKey(day)}
            title={
              civilKey(day) === todayKey
                ? `${dayLabel(day, true)} · Aujourd'hui`
                : dayLabel(day, true)
            }
            count={list.length > 0 ? countLabel(list.length) : undefined}
            empty={list.length === 0 ? "Rien de prévu." : undefined}
          >
            {list.map((event) => (
              <AgendaRow key={event.id} event={event} timeZone={timeZone} />
            ))}
          </ProgramCard>
        );
      })}
    </div>
  );
}
