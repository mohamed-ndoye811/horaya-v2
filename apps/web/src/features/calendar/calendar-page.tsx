import { addDays } from "@horaya/core";
import type { EventRow } from "@horaya/db";
import { FabLink } from "@/components/app/fab";
import { PageHeader } from "@/components/app/page-header";
import { CalendarLegend } from "@/components/calendar/legend";
import { DayAgenda, MonthCompact, WeekAgenda, WeekStrip } from "@/components/calendar/mobile";
import { MonthCalendar } from "@/components/calendar/month-calendar";
import { TimeGridCalendar } from "@/components/calendar/time-grid";
import type { CalendarEvent } from "@/components/calendar/types";
import { Avatar, CategorySwatch } from "@/components/ui/avatar";
import { ButtonLink } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, CloseIcon, PlusIcon } from "@/components/ui/icons";
import { Eyebrow } from "@/components/ui/section";
import { SegmentedLinks } from "@/components/ui/segmented";
import type { getCalendar } from "@/functions/calendar";
import { type CivilDate, civilKey } from "@/lib/calendar";
import { addMonths, isoWeek, startOfDay } from "@/lib/dates";
import { formatEventRange } from "@/lib/format";
import { Link } from "@/lib/navigation";
import { withParams } from "@/lib/search-params";
import { calendarPeriod, type CalendarView as View } from "./period";

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
const WEEKDAYS = ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi", "Dimanche"];

const capitalize = (word: string) => word.charAt(0).toUpperCase() + word.slice(1);
const plural = (count: number, word: string) => `${count} ${word}${count > 1 ? "s" : ""}`;

/** Écrans 06 à 08 : calendrier mois, semaine, jour. */
export function CalendarPage({
  data,
  view,
}: {
  data: Awaited<ReturnType<typeof getCalendar>>;
  view: View;
}) {
  const { timeZone, now, today, date, workspaceName, rows, types, selected } = data;

  // Période affichée et navigation.
  const { days, previous, next } = calendarPeriod(view, date);
  const first = days[0] ?? date;
  const last = days.at(-1) ?? date;
  const from = startOfDay(first, timeZone);
  const to = startOfDay(addDays(last, 1), timeZone);

  const href = (overrides: { vue?: View; date?: CivilDate; evenement?: string }) =>
    withParams("/app/calendrier", {
      vue: overrides.vue ?? view,
      date: civilKey(overrides.date ?? date),
      evenement: overrides.evenement,
    });

  const toCalendarEvent = (row: EventRow): CalendarEvent => ({
    id: row.id,
    title: row.status === "draft" ? `${row.title} (brouillon)` : row.title,
    startsAt: row.startsAt,
    endsAt: row.endsAt,
    color: row.typeColor,
    detail: [
      row.locationName,
      row.capacity === null
        ? null
        : row.seatsHeld >= row.capacity
          ? "Complet"
          : `${row.seatsHeld} / ${row.capacity}`,
    ]
      .filter(Boolean)
      .join(" · "),
    href: view === "jour" ? href({ evenement: row.id }) : `/app/evenements/${row.id}`,
  });
  const events = rows.map(toCalendarEvent);

  const inMonth =
    view === "mois"
      ? rows.filter(
          (row) =>
            row.startsAt >= startOfDay({ ...date, day: 1 }, timeZone) &&
            row.startsAt < startOfDay(addMonths(date, 1), timeZone),
        )
      : rows;
  const eyebrow =
    view === "mois"
      ? `Calendrier · ${plural(inMonth.length, "événement")} ce mois-ci`
      : view === "semaine"
        ? `Calendrier · Semaine ${isoWeek(first)} · ${plural(rows.length, "événement")}`
        : `${civilKey(date) === civilKey(today) ? "Aujourd'hui" : "Calendrier"} · ${plural(rows.length, "événement")}`;
  const title =
    view === "mois"
      ? `${capitalize(MONTHS[date.month - 1] ?? "")} ${date.year}`
      : view === "semaine"
        ? first.month === last.month
          ? `${first.day} – ${last.day} ${SHORT_MONTHS[last.month - 1]}`
          : `${first.day} ${SHORT_MONTHS[first.month - 1]} – ${last.day} ${SHORT_MONTHS[last.month - 1]}`
        : `${WEEKDAYS[(new Date(Date.UTC(date.year, date.month - 1, date.day)).getUTCDay() + 6) % 7]} ${date.day} ${MONTHS[date.month - 1]}`;
  // Sur mobile, le titre tient sur une ligne avec les flèches (250 px au plus) : sans
  // l'année pour le mois (elle passe dans le sur-titre), en abrégé pour la semaine et le jour.
  const mobileEyebrow =
    view === "mois" ? `${date.year} · ${plural(inMonth.length, "événement")}` : eyebrow;
  const mobileTitle =
    view === "mois"
      ? capitalize(MONTHS[date.month - 1] ?? "")
      : view === "semaine"
        ? first.month === last.month
          ? title
          : `${first.day}/${first.month} – ${last.day}/${last.month}`
        : `${WEEKDAYS[(new Date(Date.UTC(date.year, date.month - 1, date.day)).getUTCDay() + 6) % 7]?.slice(0, 3)}. ${date.day} ${SHORT_MONTHS[date.month - 1]}`;

  // Sous-titre : « Juin 2026. 2 événements aujourd'hui, 6 cette semaine. »
  const todayStart = startOfDay(today, timeZone);
  const todayEnd = startOfDay(addDays(today, 1), timeZone);
  const showsToday = todayStart >= from && todayStart < to;
  const todayCount = rows.filter(
    (row) => row.startsAt < todayEnd && row.endsAt > todayStart,
  ).length;
  const monthLabel = `${capitalize(MONTHS[date.month - 1] ?? "")} ${date.year}.`;
  const period = view === "mois" ? "ce mois-ci" : view === "semaine" ? "cette semaine" : null;
  const summary =
    period === null
      ? `${plural(rows.length, "événement")}.`
      : showsToday
        ? `${todayCount === 0 ? "Aucun événement" : plural(todayCount, "événement")} aujourd'hui, ${inMonth.length} ${period}.`
        : `${plural(inMonth.length, "événement")} ${period}.`;

  // Plage horaire : 8 h – 20 h, élargie si des événements débordent.
  const hours = rows
    .filter((row) => row.endsAt.getTime() - row.startsAt.getTime() < 20 * 3_600_000)
    .flatMap((row) => {
      const startHour = Number(
        new Intl.DateTimeFormat("en-GB", { hour: "2-digit", hourCycle: "h23", timeZone }).format(
          row.startsAt,
        ),
      );
      const endHour = Number(
        new Intl.DateTimeFormat("en-GB", { hour: "2-digit", hourCycle: "h23", timeZone }).format(
          row.endsAt,
        ),
      );
      return [startHour, endHour + 1];
    });
  const startHour = Math.min(8, ...hours.filter((hour) => hour >= 0));
  const endHour = Math.min(24, Math.max(20, ...hours));

  const newEventHref = withParams("/app/evenements/nouveau", {
    date: civilKey(
      view === "mois" && civilKey(date) !== civilKey(today) ? { ...date, day: 1 } : date,
    ),
  });

  const periodNav = (
    <nav
      aria-label="Période"
      className="flex h-10 shrink-0 items-center rounded-full bg-surface p-[3px] shadow-[0_1px_2px_rgba(0,0,0,0.04)]"
    >
      <Link
        href={href({ date: previous })}
        aria-label="Période précédente"
        className="flex size-[34px] items-center justify-center rounded-full text-ink hover:bg-field"
      >
        <ChevronLeft />
      </Link>
      <Link
        href={href({ date: today })}
        className="flex h-[34px] items-center rounded-full px-3 text-sm font-semibold leading-[18px] text-ink hover:bg-field"
      >
        Aujourd'hui
      </Link>
      <Link
        href={href({ date: next })}
        aria-label="Période suivante"
        className="flex size-[34px] items-center justify-center rounded-full text-ink hover:bg-field"
      >
        <ChevronRight />
      </Link>
    </nav>
  );

  const views = [
    { value: "mois", label: "Mois", href: href({ vue: "mois" }) },
    { value: "semaine", label: "Semaine", href: href({ vue: "semaine" }) },
    { value: "jour", label: "Jour", href: href({ vue: "jour" }) },
  ];

  return (
    <>
      <PageHeader
        eyebrow={
          <>
            <span className="lg:hidden">{mobileEyebrow}</span>
            <span className="hidden lg:inline">{eyebrow}</span>
          </>
        }
        title={
          <>
            <span className="lg:hidden">{mobileTitle}</span>
            <span className="hidden lg:inline">{title}</span>
          </>
        }
        subtitle={
          <>
            {view !== "mois" && `${monthLabel} `}
            <span className="text-ink">{summary}</span>
          </>
        }
        toolbar={
          <>
            <CalendarLegend categories={types} />
            {/* Sur mobile, période et vues sur une seule ligne, vues en pleine largeur. */}
            <div className="flex gap-3">
              {periodNav}
              <div className="min-w-0 flex-1 sm:hidden">
                <SegmentedLinks
                  label="Vue du calendrier"
                  value={view}
                  segments={views}
                  size="sm"
                  fill
                />
              </div>
              <div className="hidden sm:block">
                <SegmentedLinks label="Vue du calendrier" value={view} segments={views} size="sm" />
              </div>
            </div>
          </>
        }
        actions={
          <div className="hidden lg:flex">
            <ButtonLink href={newEventHref} icon={<PlusIcon />}>
              Nouvel événement
            </ButtonLink>
          </div>
        }
      />

      {/* Changement de vue ou de date : transition de page du routeur (voir router.tsx). */}
      <div className="flex flex-col">
        {view === "mois" && (
          <>
            <MonthCompact
              year={date.year}
              month={date.month}
              events={events}
              timeZone={timeZone}
              today={today}
              selected={date}
              dayHref={(day) => href({ date: day })}
            />
            <DayAgenda day={date} events={events} timeZone={timeZone} />
            <div className="hidden lg:block">
              <MonthCalendar
                year={date.year}
                month={date.month}
                events={events}
                timeZone={timeZone}
                today={today}
                moreHref={(day) => href({ vue: "jour", date: day })}
              />
            </div>
          </>
        )}
        {view === "semaine" && (
          <>
            <WeekStrip
              days={days}
              events={events}
              timeZone={timeZone}
              today={today}
              dayHref={(day) => href({ vue: "jour", date: day })}
            />
            <WeekAgenda days={days} events={events} timeZone={timeZone} today={today} />
            <div className="hidden lg:block">
              <TimeGridCalendar
                days={days}
                events={events}
                timeZone={timeZone}
                today={today}
                now={now}
                startHour={startHour}
                endHour={endHour}
              />
            </div>
          </>
        )}
        {view === "jour" && (
          <div className="flex flex-col lg:flex-row lg:items-start lg:pr-4">
            <div className="min-w-0 flex-1">
              <TimeGridCalendar
                days={days}
                events={events}
                timeZone={timeZone}
                today={today}
                now={now}
                startHour={startHour}
                endHour={endHour}
              />
            </div>
            {selected && (
              <Link
                href={href({})}
                aria-label="Fermer le détail"
                className="fixed inset-0 z-40 bg-ink/45 lg:hidden"
              />
            )}
            {selected && (
              <aside className="fixed inset-x-0 bottom-0 z-50 flex max-h-[85dvh] animate-[rise_380ms_cubic-bezier(0.2,0,0,1)_backwards] flex-col overflow-y-auto rounded-t-3xl bg-surface pb-[env(safe-area-inset-bottom)] lg:sticky lg:top-4 lg:z-auto lg:max-h-none lg:w-[380px] lg:shrink-0 lg:animate-none lg:overflow-visible lg:rounded-3xl lg:pb-0">
                <div aria-hidden="true" className="flex justify-center pt-2.5 lg:hidden">
                  <span className="h-1 w-10 rounded-full bg-line" />
                </div>
                <div className="flex items-start justify-between gap-4 border-b border-line-soft px-6 py-5">
                  <div className="flex min-w-0 flex-col gap-3">
                    <p className="flex items-center gap-2 text-xs font-bold leading-4 text-ink-muted">
                      <CategorySwatch color={selected.event.typeColor} size={10} />
                      {selected.event.typeName} · {workspaceName}
                    </p>
                    <h2 className="font-headline text-[32px] leading-9 text-ink">
                      {selected.event.title}
                    </h2>
                    <p className="text-[15px] font-medium text-ink-muted">
                      {formatEventRange(selected.event.startsAt, selected.event.endsAt, timeZone)}
                    </p>
                  </div>
                  <Link
                    href={href({})}
                    aria-label="Fermer"
                    className="flex size-9 shrink-0 items-center justify-center rounded-full text-ink hover:bg-field"
                  >
                    <CloseIcon />
                  </Link>
                </div>
                {selected.event.locationName && (
                  <div className="flex flex-col gap-2 border-b border-line-soft px-6 py-4">
                    <Eyebrow>Lieu</Eyebrow>
                    <p className="text-base font-semibold text-ink">
                      {selected.event.locationName}
                    </p>
                  </div>
                )}
                <div className="flex flex-col gap-3 border-b border-line-soft px-6 py-4">
                  <Eyebrow>
                    Participants · {selected.event.seatsHeld}
                    {selected.event.capacity !== null ? ` / ${selected.event.capacity}` : ""}
                  </Eyebrow>
                  <div className="flex flex-wrap gap-1.5">
                    {selected.bookings
                      .filter((entry) => entry.status === "confirmed" || entry.status === "pending")
                      .slice(0, 12)
                      .map((entry) => (
                        <span key={entry.id} title={entry.customerName}>
                          <Avatar name={entry.customerName} size="md" />
                        </span>
                      ))}
                    {selected.bookings.length === 0 && (
                      <p className="text-sm font-medium text-ink-muted">Aucune réservation.</p>
                    )}
                  </div>
                </div>
                {selected.event.description && (
                  <div className="flex flex-col gap-2 border-b border-line-soft px-6 py-4">
                    <Eyebrow>Description</Eyebrow>
                    <p className="line-clamp-6 text-sm font-medium leading-6 text-ink">
                      {selected.event.description}
                    </p>
                  </div>
                )}
                <div className="mt-auto flex gap-3 px-6 py-5">
                  <ButtonLink
                    href={`/app/evenements/${selected.event.id}/modifier`}
                    className="flex-1"
                  >
                    Modifier
                  </ButtonLink>
                  <ButtonLink
                    href={`/app/evenements/${selected.event.id}`}
                    variant="secondary"
                    className="flex-1"
                  >
                    Voir la fiche
                  </ButtonLink>
                </div>
              </aside>
            )}
          </div>
        )}
      </div>
      <FabLink href={newEventHref}>Nouveau</FabLink>
    </>
  );
}
