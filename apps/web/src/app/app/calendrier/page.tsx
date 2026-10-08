import { addDays } from "@horaya/core";
import { type EventRow, getEventDetail, listEventsInRange, listEventTypes } from "@horaya/db";
import type { Metadata } from "next";
import Link from "next/link";
import { FabLink } from "@/components/app/fab";
import { PageHeader } from "@/components/app/page-header";
import { CalendarLegend } from "@/components/calendar/legend";
import { DayAgenda, MonthCompact, WeekAgenda, WeekStrip } from "@/components/calendar/mobile";
import { MonthCalendar } from "@/components/calendar/month-calendar";
import { TimeGridCalendar } from "@/components/calendar/time-grid";
import type { CalendarEvent } from "@/components/calendar/types";
import { Avatar, CategorySwatch } from "@/components/ui/avatar";
import { ButtonLink, IconLink } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, CloseIcon, PlusIcon } from "@/components/ui/icons";
import { Eyebrow } from "@/components/ui/section";
import { SegmentedLinks } from "@/components/ui/segmented";
import { type CivilDate, civilKey, monthGrid } from "@/lib/calendar";
import { addMonths, isoWeek, mondayOf, parseCivilDate, startOfDay, todayIn } from "@/lib/dates";
import { formatEventRange } from "@/lib/format";
import { param, withParams } from "@/lib/search-params";
import { db } from "@/server/db";
import { getWorkspaceContext } from "@/server/workspace";

export const metadata: Metadata = { title: "Calendrier · Horaya" };

type View = "mois" | "semaine" | "jour";
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

const plural = (count: number, word: string) => `${count} ${word}${count > 1 ? "s" : ""}`;

/** Écrans 06 à 08 : calendrier mois, semaine, jour. */
export default async function CalendarPage({ searchParams }: PageProps<"/app/calendrier">) {
  const { workspace, timeZone } = await getWorkspaceContext();
  const query = await searchParams;
  const view: View =
    (["mois", "semaine", "jour"] as const).find((entry) => entry === param(query.vue)) ?? "mois";
  const today = todayIn(timeZone);
  const date = parseCivilDate(param(query.date)) ?? today;
  const selectedId = param(query.evenement);

  // Période affichée et navigation.
  let days: CivilDate[];
  let previous: CivilDate;
  let next: CivilDate;
  if (view === "mois") {
    const weeks = monthGrid(date.year, date.month);
    days = weeks.flat();
    previous = addMonths(date, -1);
    next = addMonths(date, 1);
  } else if (view === "semaine") {
    const monday = mondayOf(date);
    days = Array.from({ length: 7 }, (_, offset) => addDays(monday, offset));
    previous = addDays(monday, -7);
    next = addDays(monday, 7);
  } else {
    days = [date];
    previous = addDays(date, -1);
    next = addDays(date, 1);
  }
  const first = days[0] ?? date;
  const last = days.at(-1) ?? date;
  const from = startOfDay(first, timeZone);
  const to = startOfDay(addDays(last, 1), timeZone);

  const [rows, types] = await Promise.all([
    listEventsInRange(db, workspace.id, { from, to }),
    listEventTypes(db, workspace.id),
  ]);
  const selected = selectedId ? await getEventDetail(db, workspace.id, selectedId) : null;

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
      row.capacity !== null ? `${row.seatsHeld} / ${row.capacity} places` : null,
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
      ? `${MONTHS[date.month - 1]} ${date.year}`
      : view === "semaine"
        ? first.month === last.month
          ? `${first.day} – ${last.day} ${SHORT_MONTHS[last.month - 1]}`
          : `${first.day} ${SHORT_MONTHS[first.month - 1]} – ${last.day} ${SHORT_MONTHS[last.month - 1]}`
        : `${WEEKDAYS[(new Date(Date.UTC(date.year, date.month - 1, date.day)).getUTCDay() + 6) % 7]} ${date.day} ${MONTHS[date.month - 1]}`;

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

  return (
    <>
      <PageHeader
        eyebrow={eyebrow}
        title={title}
        titleAside={
          <div className="flex gap-2">
            <IconLink label="Période précédente" href={href({ date: previous })}>
              <ChevronLeft />
            </IconLink>
            <IconLink label="Période suivante" href={href({ date: next })}>
              <ChevronRight />
            </IconLink>
          </div>
        }
        actions={
          <>
            <SegmentedLinks
              label="Vue du calendrier"
              value={view}
              segments={[
                { value: "mois", label: "Mois", href: href({ vue: "mois" }) },
                { value: "semaine", label: "Semaine", href: href({ vue: "semaine" }) },
                { value: "jour", label: "Jour", href: href({ vue: "jour" }) },
              ]}
            />
            <ButtonLink href={href({ date: today })} variant="secondary">
              Aujourd'hui
            </ButtonLink>
            <div className="hidden lg:flex">
              <ButtonLink href={newEventHref} icon={<PlusIcon />}>
                Nouvel événement
              </ButtonLink>
            </div>
          </>
        }
      />
      <CalendarLegend categories={types.map((type) => ({ name: type.name, color: type.color }))} />

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
              now={new Date()}
              startHour={startHour}
              endHour={endHour}
            />
          </div>
        </>
      )}
      {view === "jour" && (
        <div className="flex flex-col lg:flex-row">
          <div className="min-w-0 flex-1">
            <TimeGridCalendar
              days={days}
              events={events}
              timeZone={timeZone}
              today={today}
              now={new Date()}
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
            <aside className="fixed inset-x-0 bottom-0 z-50 flex max-h-[85dvh] flex-col overflow-y-auto border-t-2 border-ink bg-surface pb-[env(safe-area-inset-bottom)] lg:static lg:z-auto lg:max-h-none lg:w-[380px] lg:shrink-0 lg:overflow-visible lg:border-t-0 lg:border-l-2 lg:pb-0">
              <div aria-hidden="true" className="flex justify-center pt-2.5 lg:hidden">
                <span className="h-1 w-10 bg-ink-subtle" />
              </div>
              <div className="flex items-start justify-between gap-4 border-b border-line-soft px-7 py-6">
                <div className="flex min-w-0 flex-col gap-3">
                  <p className="flex items-center gap-2 font-mono text-label font-semibold uppercase tracking-[0.055em] text-neutral">
                    <CategorySwatch color={selected.event.typeColor} size={10} />
                    {selected.event.typeName} · {workspace.name}
                  </p>
                  <h2 className="font-headline text-[36px] leading-9 text-ink">
                    {selected.event.title}
                  </h2>
                  <p className="text-[15px] font-medium text-ink-muted">
                    {formatEventRange(selected.event.startsAt, selected.event.endsAt, timeZone)}
                  </p>
                </div>
                <Link
                  href={href({})}
                  aria-label="Fermer"
                  className="flex size-9 shrink-0 items-center justify-center text-ink hover:bg-draft-bg"
                >
                  <CloseIcon />
                </Link>
              </div>
              {selected.event.locationName && (
                <div className="flex flex-col gap-2 border-b border-line-soft px-7 py-5">
                  <Eyebrow>Lieu</Eyebrow>
                  <p className="text-base font-semibold text-ink">{selected.event.locationName}</p>
                </div>
              )}
              <div className="flex flex-col gap-3 border-b border-line-soft px-7 py-5">
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
                <div className="flex flex-col gap-2 border-b border-line-soft px-7 py-5">
                  <Eyebrow>Description</Eyebrow>
                  <p className="line-clamp-6 text-sm font-medium leading-6 text-ink">
                    {selected.event.description}
                  </p>
                </div>
              )}
              <div className="mt-auto flex gap-3 px-7 py-6">
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
      <FabLink href={newEventHref}>Nouvel événement</FabLink>
    </>
  );
}
