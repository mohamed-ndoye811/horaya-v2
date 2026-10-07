import { weekdayOf } from "@horaya/core";
import Link from "next/link";
import type { CSSProperties } from "react";
import { type CivilDate, civilKey, isAllDay, layoutDay, layoutSpans } from "@/lib/calendar";
import { cn } from "@/lib/cn";
import { textOn } from "@/lib/colors";
import { formatHour, formatTimeRange, formatWeekdayShort } from "@/lib/format";
import { type CalendarEvent, WEEKDAY_LABELS } from "./types";

/** Hauteur d'une heure dans la grille (maquette : 76 px). */
const HOUR_HEIGHT = 76;

/**
 * Vues Semaine et Jour (écrans 07 et 08) : ligne « Jour » pour les événements sur
 * plusieurs jours, puis grille horaire avec les événements placés en colonnes quand
 * ils se chevauchent, et la ligne rouge de l'heure actuelle.
 */
export function TimeGridCalendar({
  days,
  events,
  timeZone,
  today,
  now,
  startHour = 8,
  endHour = 20,
}: {
  days: CivilDate[];
  events: CalendarEvent[];
  timeZone: string;
  today: CivilDate;
  now: Date;
  startHour?: number;
  endHour?: number;
}) {
  const allDay = events.filter((event) => isAllDay(event, timeZone));
  const timed = events.filter((event) => !isAllDay(event, timeZone));
  const spans = layoutSpans(allDay, days, timeZone);
  const lanes = Math.max(1, ...spans.map((span) => span.lane + 1));
  const hours = Array.from({ length: endHour - startHour }, (_, index) => startHour + index);
  const todayKey = civilKey(today);
  const columns = `56px repeat(${days.length}, minmax(0, 1fr))`;
  const pxPerMinute = HOUR_HEIGHT / 60;

  return (
    <div className="overflow-x-auto">
      <div className={days.length > 1 ? "min-w-[840px]" : undefined}>
        {/* En-têtes des jours */}
        <div className="grid border-b border-line-soft" style={{ gridTemplateColumns: columns }}>
          <span />
          {days.map((day) => {
            const weekday = weekdayOf(day.year, day.month, day.day);
            const isToday = civilKey(day) === todayKey;
            return (
              <div
                key={civilKey(day)}
                className={cn(
                  "flex items-center gap-2 border-l border-line-soft p-2.5",
                  isToday ? "bg-today" : weekday >= 5 && "bg-weekend",
                )}
              >
                <span
                  className={cn(
                    "font-mono text-label font-semibold uppercase tracking-[0.055em]",
                    weekday >= 5 ? "text-neutral" : "text-ink",
                  )}
                >
                  {WEEKDAY_LABELS[weekday]}
                </span>
                <span
                  className={cn(
                    "text-base font-extrabold leading-5",
                    isToday ? "bg-ink px-1.5 py-0.5 text-on-ink" : "text-ink",
                  )}
                >
                  {day.day}
                </span>
              </div>
            );
          })}
        </div>

        {/* Ligne « Jour » */}
        <div className="grid border-b-2 border-ink" style={{ gridTemplateColumns: columns }}>
          <span className="flex justify-end pt-2.5 pr-2 font-mono text-[10px] font-semibold uppercase tracking-[0.04em] text-neutral">
            Jour
          </span>
          <div
            className="relative grid gap-y-1 border-l border-line-soft py-1.5"
            style={{
              gridColumn: `2 / span ${days.length}`,
              gridTemplateColumns: `repeat(${days.length}, minmax(0, 1fr))`,
              gridTemplateRows: `repeat(${lanes}, 26px)`,
              minHeight: 40,
            }}
          >
            {spans.map(({ item, startColumn, endColumn, lane }) => (
              <EventBar
                key={item.id}
                event={item}
                timeZone={timeZone}
                style={{
                  gridColumn: `${startColumn + 1} / ${endColumn + 2}`,
                  gridRow: lane + 1,
                }}
              />
            ))}
          </div>
        </div>

        {/* Grille horaire */}
        <div className="relative grid" style={{ gridTemplateColumns: columns }}>
          <div className="flex flex-col">
            {hours.map((hour) => (
              <span
                key={hour}
                className="flex justify-end pt-1 pr-2 font-mono text-label font-medium leading-[14px] text-ink-muted"
                style={{ height: HOUR_HEIGHT }}
              >
                {hour}h
              </span>
            ))}
          </div>
          {days.map((day) => {
            const weekday = weekdayOf(day.year, day.month, day.day);
            const isToday = civilKey(day) === todayKey;
            const placed = layoutDay(timed, day, timeZone, { startHour, endHour });
            const nowMinutes = isToday ? minutesSinceStart(now, timeZone, startHour) : null;
            return (
              <div
                key={civilKey(day)}
                className={cn(
                  "relative border-l border-line-soft",
                  isToday ? "bg-ink/5" : weekday >= 5 && "bg-black/[0.035]",
                )}
                style={{
                  height: hours.length * HOUR_HEIGHT,
                  backgroundImage: `repeating-linear-gradient(to bottom, var(--color-line-soft) 0 1px, transparent 1px ${HOUR_HEIGHT}px)`,
                }}
              >
                {placed.map(({ item, top, height, column, columns: count }) => (
                  <EventBlock
                    key={item.id}
                    event={item}
                    timeZone={timeZone}
                    style={{
                      top: top * pxPerMinute,
                      height: height * pxPerMinute - 2,
                      left: `calc(${(column / count) * 100}% + 4px)`,
                      width: `calc(${100 / count}% - 8px)`,
                    }}
                    compact={height * pxPerMinute < 56}
                    stacked={column > 0}
                  />
                ))}
                {nowMinutes !== null && nowMinutes >= 0 && nowMinutes <= hours.length * 60 && (
                  <div
                    aria-hidden="true"
                    className="pointer-events-none absolute inset-x-0"
                    style={{ top: nowMinutes * pxPerMinute }}
                  >
                    <div className="h-0.5 bg-danger" />
                    <div className="absolute -top-1 -left-[5px] size-2.5 rounded-dot bg-danger" />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function minutesSinceStart(now: Date, timeZone: string, startHour: number): number {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);
  const hour = Number(parts.find((part) => part.type === "hour")?.value ?? 0);
  const minute = Number(parts.find((part) => part.type === "minute")?.value ?? 0);
  return (hour - startHour) * 60 + minute;
}

/** « Lun. 14h → Mar. 16h30 » ; rien pour une journée entière (de minuit à minuit). */
function spanLabel(event: CalendarEvent, timeZone: string): string | null {
  const start = formatHour(event.startsAt, timeZone);
  const end = formatHour(event.endsAt, timeZone);
  if (start === "0h" && end === "0h") return null;
  return `${formatWeekdayShort(event.startsAt, timeZone)} ${start} → ${formatWeekdayShort(event.endsAt, timeZone)} ${end}`;
}

function EventBar({
  event,
  timeZone,
  style,
}: {
  event: CalendarEvent;
  timeZone: string;
  style: CSSProperties;
}) {
  const color = textOn(event.color);
  const content = (
    <>
      <span className="truncate text-[13px] font-bold leading-4">{event.title}</span>
      {spanLabel(event, timeZone) && (
        <span className="hidden shrink-0 font-mono text-[11px] font-semibold opacity-85 sm:inline">
          {spanLabel(event, timeZone)}
        </span>
      )}
    </>
  );
  const className = "mx-1 flex min-w-0 items-center gap-2 overflow-hidden px-2.5";
  const merged = { ...style, backgroundColor: event.color, color };
  return event.href ? (
    <Link href={event.href} className={className} style={merged} title={event.title}>
      {content}
    </Link>
  ) : (
    <div className={className} style={merged} title={event.title}>
      {content}
    </div>
  );
}

function EventBlock({
  event,
  timeZone,
  style,
  compact,
  stacked,
}: {
  event: CalendarEvent;
  timeZone: string;
  style: CSSProperties;
  /** Événement court : heure et titre sur une ligne. */
  compact: boolean;
  /** Décalé à droite d'un autre : filet couleur de fond pour le détacher. */
  stacked: boolean;
}) {
  const color = textOn(event.color);
  const className = cn(
    "absolute flex overflow-hidden px-2 hover:brightness-95",
    compact ? "items-center gap-1.5 py-1" : "flex-col gap-0.5 py-1.5",
    stacked && "border-t-2 border-l-2 border-bg",
  );
  const content = compact ? (
    <>
      <span className="shrink-0 font-mono text-[11px] font-semibold opacity-85">
        {formatHour(event.startsAt, timeZone)}
      </span>
      <span className="truncate text-[13px] font-bold leading-4">{event.title}</span>
    </>
  ) : (
    <>
      <span className="font-mono text-[11px] font-semibold leading-[13px] opacity-85">
        {formatTimeRange(event.startsAt, event.endsAt, timeZone).replace(" – ", " - ")}
      </span>
      <span className="text-[13px] font-bold leading-4">{event.title}</span>
      {event.detail && (
        <span className="text-label font-medium leading-[15px]">{event.detail}</span>
      )}
    </>
  );
  const merged = { ...style, backgroundColor: event.color, color };
  return event.href ? (
    <Link href={event.href} className={className} style={merged} title={event.title}>
      {content}
    </Link>
  ) : (
    <div className={className} style={merged} title={event.title}>
      {content}
    </div>
  );
}
