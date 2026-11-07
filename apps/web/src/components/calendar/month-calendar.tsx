import { rowLinkClasses } from "@/components/ui/button";
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
    <div className={cn(calendarCard, "flex-1")}>
      <div className="flex-1 overflow-x-auto">
        {/* Plus haut que ses lignes : les semaines se partagent la hauteur (124 px au moins). */}
        <table
          aria-label="Calendrier du mois"
          className="h-full w-full min-w-[840px] table-fixed border-collapse"
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
                // Part égale de la hauteur : sinon la semaine la plus remplie prend le surplus.
                style={{ height: `${100 / weeks.length}%` }}
                className="border-b border-line-faint last:border-b-0"
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
                        "h-[124px] border-r border-line-faint px-2 py-2 align-top last:border-r-0",
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
                              className={cn(rowLinkClasses, "px-0.5 text-label")}
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
