import { type CivilDate, civilKey, groupByDay, isAllDay, monthGrid } from "@/lib/calendar";
import { cn } from "@/lib/cn";
import { formatHour } from "@/lib/format";
import { EventChip } from "./event-chip";
import { calendarCard } from "./time-grid";
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
    <div className={calendarCard}>
      <div className="overflow-x-auto">
        <table
          aria-label="Calendrier du mois"
          className="w-full min-w-[840px] table-fixed border-collapse"
        >
          <thead>
            <tr className="h-12 border-b border-line-soft">
              {WEEKDAY_LABELS.map((label, index) => (
                <th
                  key={label}
                  scope="col"
                  className={cn(
                    "px-3 text-left text-xs font-semibold uppercase leading-4 text-ink-subtle",
                    index >= 5 && "bg-band",
                  )}
                >
                  {label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {weeks.map((week) => (
              <tr
                key={civilKey(week[0] ?? today)}
                className="border-b border-[#f4f4f2] last:border-b-0"
              >
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
                        "h-[124px] border-r border-[#f4f4f2] px-2 py-2 align-top last:border-r-0",
                        index >= 5 && "bg-band",
                      )}
                    >
                      <div className="flex min-w-0 flex-col gap-1">
                        {isToday ? (
                          <div className="flex items-center gap-2">
                            <span className="flex size-[26px] items-center justify-center rounded-full bg-ink text-sm font-bold leading-[18px] text-on-ink">
                              {day.day}
                            </span>
                            <span className="text-xs font-bold leading-4 text-ink">
                              Aujourd'hui
                            </span>
                          </div>
                        ) : (
                          <span
                            className={cn(
                              "flex h-[26px] items-center px-1 text-[15px] font-semibold leading-[18px]",
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
    </div>
  );
}
