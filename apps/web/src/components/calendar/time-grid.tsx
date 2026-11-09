import { weekdayOf } from "@horaya/core";
import type { CSSProperties } from "react";
import { cardShellClasses } from "@/components/ui/section";
import { type CivilDate, civilKey, isAllDay, layoutDay, layoutSpans } from "@/lib/calendar";
import { cn } from "@/lib/cn";
import { shadeOf, tintOf } from "@/lib/colors";
import { formatHour, formatTimeRange, formatWeekdayShort } from "@/lib/format";
import { Link } from "@/lib/navigation";
import { type CalendarEvent, WEEKDAY_LABELS } from "./types";

/** Hauteur minimale d'une heure (maquette 1.3 : 64 px) ; la grille s'étire sur toute la hauteur. */
const HOUR_HEIGHT = 64;
/** Filets de la grille, plus clairs que `line-soft` (maquette : #F4F4F2). */
const GRID_LINE = "var(--color-line-faint)";

/** Carte blanche des vues du calendrier (DA v4). */
export const calendarCard = `${cardShellClasses} mx-4 overflow-hidden`;

/**
 * Vues Semaine et Jour (maquette 1.3) : en-têtes des jours, ligne « Jour » pour les
 * événements sur plusieurs jours s'il y en a, puis grille horaire avec les événements
 * placés en colonnes quand ils se chevauchent, et le trait orange de l'heure actuelle.
 */
export function TimeGridCalendar({
  days,
  events,
  timeZone,
  today,
  now,
  startHour = 8,
  endHour = 20,
  dayHref,
  slotHref,
}: {
  days: CivilDate[];
  events: CalendarEvent[];
  timeZone: string;
  today: CivilDate;
  now: Date;
  startHour?: number;
  endHour?: number;
  /** En-tête d'un jour cliquable (vers la vue Jour). */
  dayHref?: (day: CivilDate) => string;
  /** Créneau vide cliquable : créer un événement ce jour, à cette heure. */
  slotHref?: (day: CivilDate, hour: number) => string;
}) {
  const allDay = events.filter((event) => isAllDay(event, timeZone));
  const timed = events.filter((event) => !isAllDay(event, timeZone));
  const spans = layoutSpans(allDay, days, timeZone);
  const lanes = Math.max(1, ...spans.map((span) => span.lane + 1));
  const hours = Array.from({ length: endHour - startHour }, (_, index) => startHour + index);
  const todayKey = civilKey(today);
  const columns = `60px repeat(${days.length}, minmax(0, 1fr))`;
  const pxPerMinute = HOUR_HEIGHT / 60;
  // Positions en % de la hauteur de la grille : elle s'étire, les événements suivent.
  const percent = (minutes: number) => (minutes / (hours.length * 60)) * 100;
  const isWeekend = (day: CivilDate) => weekdayOf(day.year, day.month, day.day) >= 5;

  return (
    <div className={cn(calendarCard, "flex-1")}>
      <div className="flex flex-1 flex-col overflow-x-auto">
        <div className={cn("flex flex-1 flex-col", days.length > 1 && "min-w-[840px]")}>
          {/* En-têtes des jours */}
          <div
            className="grid h-[60px] border-b border-line-soft"
            style={{ gridTemplateColumns: columns }}
          >
            <span />
            {days.map((day) => {
              const isToday = civilKey(day) === todayKey;
              const weekend = isWeekend(day);
              const content = (
                <>
                  <span
                    className={cn(
                      "text-xs uppercase leading-4",
                      isToday ? "font-bold text-ink" : "font-semibold text-ink-subtle",
                    )}
                  >
                    {WEEKDAY_LABELS[weekdayOf(day.year, day.month, day.day)]}
                  </span>
                  {isToday ? (
                    <span className="flex size-8 items-center justify-center rounded-full bg-accent text-ui font-bold leading-[18px] text-ink">
                      {day.day}
                    </span>
                  ) : (
                    <span
                      className={cn(
                        "text-lg font-semibold leading-[22px]",
                        weekend ? "text-ink-subtle" : "text-ink",
                      )}
                    >
                      {day.day}
                    </span>
                  )}
                </>
              );
              const className = cn(
                "flex items-center justify-center gap-2",
                weekend && "bg-band",
                dayHref && "transition-colors hover:bg-field",
              );
              return dayHref ? (
                <Link
                  key={civilKey(day)}
                  href={dayHref(day)}
                  aria-current={isToday ? "date" : undefined}
                  className={className}
                >
                  {content}
                </Link>
              ) : (
                <div
                  key={civilKey(day)}
                  aria-current={isToday ? "date" : undefined}
                  className={className}
                >
                  {content}
                </div>
              );
            })}
          </div>

          {/* Ligne « Jour » : seulement quand un événement dure toute la journée ou plus. */}
          {spans.length > 0 && (
            <div
              className="grid border-b border-line-soft"
              style={{ gridTemplateColumns: columns }}
            >
              <span className="flex justify-end pt-2.5 pr-2.5 text-[11px] font-semibold leading-[14px] text-ink-faint">
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
          )}

          {/* Grille horaire */}
          <div
            className="relative grid flex-1"
            style={{ gridTemplateColumns: columns, minHeight: hours.length * HOUR_HEIGHT }}
          >
            <div className="flex flex-col border-r border-line-soft">
              {hours.map((hour) => (
                <span
                  key={hour}
                  className="flex flex-1 justify-end pt-1.5 pr-2.5 text-[11px] font-semibold leading-[14px] text-ink-faint"
                >
                  {hour}h
                </span>
              ))}
            </div>
            {days.map((day, index) => {
              const isToday = civilKey(day) === todayKey;
              const placed = layoutDay(timed, day, timeZone, { startHour, endHour });
              const nowMinutes = isToday ? minutesSinceStart(now, timeZone, startHour) : null;
              return (
                <div
                  key={civilKey(day)}
                  className={cn("relative", isWeekend(day) && "bg-band")}
                  style={{
                    borderLeft: index > 0 ? `1px solid ${GRID_LINE}` : undefined,
                    backgroundImage: `repeating-linear-gradient(to bottom, ${GRID_LINE} 0 1px, transparent 1px ${100 / hours.length}%)`,
                  }}
                >
                  {/* Créneaux vides : un clic crée un événement à cette heure (souris ; au clavier,
                      le bouton « Nouvel événement »). */}
                  {slotHref &&
                    hours.map((hour, slot) => (
                      <Link
                        key={hour}
                        href={slotHref(day, hour)}
                        tabIndex={-1}
                        aria-label={`Créer un événement le ${day.day}/${day.month} à ${hour}h`}
                        className="group absolute inset-x-0 flex justify-end px-2 pt-1 transition-colors hover:bg-ink/[0.035]"
                        style={{
                          top: `${(slot / hours.length) * 100}%`,
                          height: `${100 / hours.length}%`,
                        }}
                      >
                        <span className="text-[11px] font-semibold leading-[14px] text-ink-muted opacity-0 transition-opacity group-hover:opacity-100">
                          + {hour}h
                        </span>
                      </Link>
                    ))}
                  {placed.map(({ item, top, height, column, columns: count }) => (
                    <EventBlock
                      key={item.id}
                      event={item}
                      timeZone={timeZone}
                      style={{
                        top: `calc(${percent(top)}% + 2px)`,
                        height: `calc(${percent(height)}% - 4px)`,
                        left: `calc(${(column / count) * 100}% + 4px)`,
                        width: `calc(${100 / count}% - 8px)`,
                      }}
                      compact={height * pxPerMinute < 56}
                    />
                  ))}
                  {nowMinutes !== null && nowMinutes >= 0 && nowMinutes <= hours.length * 60 && (
                    <div
                      aria-hidden="true"
                      className="pointer-events-none absolute inset-x-0 z-10"
                      style={{ top: `${percent(nowMinutes)}%` }}
                    >
                      <div className="h-0.5 bg-accent" />
                      <div className="absolute -top-1 -left-[5px] size-2.5 rounded-full bg-accent" />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
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

/** Fond pâle, filet de 3 px et texte foncé de la couleur du type. */
const blockStyle = (event: CalendarEvent, style: CSSProperties): CSSProperties => ({
  ...style,
  backgroundColor: tintOf(event.color),
  borderLeftColor: event.color,
  color: shadeOf(event.color),
});

function EventBar({
  event,
  timeZone,
  style,
}: {
  event: CalendarEvent;
  timeZone: string;
  style: CSSProperties;
}) {
  const content = (
    <>
      <span className="truncate text-meta font-bold leading-4 text-ink">{event.title}</span>
      {spanLabel(event, timeZone) && (
        <span className="hidden shrink-0 text-xs sm:inline">{spanLabel(event, timeZone)}</span>
      )}
    </>
  );
  const className =
    "mx-1 flex min-w-0 items-center gap-2 overflow-hidden rounded-lg border-l-[3px] px-2.5 hover:brightness-[0.97]";
  return event.href ? (
    <Link
      href={event.href}
      className={className}
      style={blockStyle(event, style)}
      title={event.title}
    >
      {content}
    </Link>
  ) : (
    <div className={className} style={blockStyle(event, style)} title={event.title}>
      {content}
    </div>
  );
}

function EventBlock({
  event,
  timeZone,
  style,
  compact,
}: {
  event: CalendarEvent;
  timeZone: string;
  style: CSSProperties;
  /** Événement court : heure et titre sur une ligne. */
  compact: boolean;
}) {
  const className = cn(
    "absolute flex overflow-hidden rounded-xl border-l-[3px] px-2.5 hover:brightness-[0.97]",
    compact ? "items-center gap-1.5 py-1" : "flex-col gap-0.5 py-2",
  );
  const content = compact ? (
    <>
      <span className="shrink-0 text-xs">{formatHour(event.startsAt, timeZone)}</span>
      <span className="truncate text-meta font-bold leading-4 text-ink">{event.title}</span>
    </>
  ) : (
    <>
      <span className="text-meta font-bold leading-[17px] text-ink">{event.title}</span>
      <span className="text-xs leading-4">
        {formatTimeRange(event.startsAt, event.endsAt, timeZone)}
      </span>
      {event.detail && <span className="text-xs leading-4">{event.detail}</span>}
    </>
  );
  return event.href ? (
    <Link
      href={event.href}
      className={className}
      style={blockStyle(event, style)}
      title={event.title}
    >
      {content}
    </Link>
  ) : (
    <div className={className} style={blockStyle(event, style)} title={event.title}>
      {content}
    </div>
  );
}
