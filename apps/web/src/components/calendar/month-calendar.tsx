import { type CivilDate, civilKey, groupByDay, isAllDay, monthGrid } from "@/lib/calendar";
import { cn } from "@/lib/cn";
import { formatHour } from "@/lib/format";
import { EventChip } from "./event-chip";
import { type CalendarEvent, WEEKDAY_LABELS } from "./types";

const SHORT_MONTHS = [
  "janv.",
  "févr.",
  "mars",
  "avr.",
  "mai",
  "juin",
  "juil.",
  "août",
  "sept.",
  "oct.",
  "nov.",
  "déc.",
];

/** Vue Mois (écran 06) : semaines du lundi au dimanche, 3 événements par jour puis « + N autres ». */
export function MonthCalendar({
  year,
  month,
  events,
  timeZone,
  today,
  maxPerDay = 3,
  moreHref,
}: {
  year: number;
  month: number;
  events: CalendarEvent[];
  timeZone: string;
  today: CivilDate;
  maxPerDay?: number;
  /** Lien « + N autres » (vers la vue Jour). */
  moreHref?: (day: CivilDate) => string;
}) {
  const weeks = monthGrid(year, month);
  const byDay = groupByDay(events, timeZone);
  const todayKey = civilKey(today);

  return (
    <div className="overflow-x-auto">
      <table
        aria-label="Calendrier du mois"
        className="w-full min-w-[840px] table-fixed border-collapse"
      >
        <thead>
          <tr className="border-b-2 border-ink">
            {WEEKDAY_LABELS.map((label) => (
              <th
                key={label}
                scope="col"
                className="p-2.5 text-left font-mono text-label font-semibold uppercase tracking-[0.055em] text-ink"
              >
                {label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {weeks.map((week) => (
            <tr key={civilKey(week[0] ?? today)} className="border-b border-line-soft">
              {week.map((day, index) => {
                const key = civilKey(day);
                const isToday = key === todayKey;
                const dayEvents = byDay.get(key) ?? [];
                const visible = dayEvents.slice(0, maxPerDay);
                const hidden = dayEvents.length - visible.length;
                const label =
                  day.day === 1 && !day.inMonth
                    ? `${day.day} ${SHORT_MONTHS[day.month - 1]}`
                    : String(day.day);
                return (
                  <td
                    key={key}
                    aria-current={isToday ? "date" : undefined}
                    className={cn(
                      "h-[132px] border-r border-line-soft px-2.5 py-2 align-top last:border-r-0",
                      isToday ? "bg-today" : index >= 5 && "bg-weekend",
                    )}
                  >
                    <div className="flex min-w-0 flex-col gap-1">
                      {isToday ? (
                        <div className="flex items-center gap-2">
                          <span className="flex h-[22px] items-center bg-ink px-1.5 text-[15px] font-extrabold leading-[18px] text-on-ink">
                            {day.day}
                          </span>
                          <span className="font-mono text-[11px] font-semibold uppercase tracking-[0.045em] text-ink">
                            Aujourd'hui
                          </span>
                        </div>
                      ) : (
                        <span
                          className={cn(
                            "text-[15px] font-bold leading-[22px]",
                            day.inMonth ? "text-ink" : "text-ink-subtle",
                          )}
                        >
                          {label}
                        </span>
                      )}
                      {visible.map((event) => (
                        <EventChip
                          key={event.id}
                          title={event.title}
                          color={event.color}
                          time={formatHour(event.startsAt, timeZone)}
                          filled={isAllDay(event, timeZone)}
                          muted={!day.inMonth}
                          href={event.href}
                        />
                      ))}
                      {hidden > 0 &&
                        (moreHref ? (
                          <a
                            href={moreHref(day)}
                            className="px-0.5 text-label font-bold text-ink hover:underline"
                          >
                            + {hidden} autre{hidden > 1 ? "s" : ""}
                          </a>
                        ) : (
                          <span className="px-0.5 text-label font-bold text-ink">
                            + {hidden} autre{hidden > 1 ? "s" : ""}
                          </span>
                        ))}
                    </div>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
