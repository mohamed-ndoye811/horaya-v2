import { addDays } from "@horaya/core";
import type { EventRow } from "@horaya/db";
import { useEffect, useRef } from "react";
import { FabLink } from "@/components/app/fab";
import { FilterSelect } from "@/components/app/filter-select";
import { PageHeader } from "@/components/app/page-header";
import { DayAgenda, MonthCompact, WeekAgenda, WeekStrip } from "@/components/calendar/mobile";
import { MonthCalendar } from "@/components/calendar/month-calendar";
import { TimeGridCalendar } from "@/components/calendar/time-grid";
import type { CalendarEvent } from "@/components/calendar/types";
import { Swap } from "@/components/motion/swap";
import { Avatar, CategorySwatch } from "@/components/ui/avatar";
import { ButtonLink } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, CloseIcon, PlusIcon } from "@/components/ui/icons";
import { Eyebrow } from "@/components/ui/section";
import { SegmentedLinks } from "@/components/ui/segmented";
import type { getCalendar } from "@/functions/calendar";
import { type CivilDate, civilKey } from "@/lib/calendar";
import { cn } from "@/lib/cn";
import { addMonths, isoWeek, startOfDay } from "@/lib/dates";
import { formatEventRange } from "@/lib/format";
import { Link, useRouter } from "@/lib/navigation";
import { withParams } from "@/lib/search-params";
import { MonthPicker } from "./month-picker";
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

/** Puce du filtre par type (sert aussi de légende). */
const TYPE_CHIP =
  "flex h-8 shrink-0 items-center gap-1.5 rounded-full px-3 text-[13px] font-semibold transition-colors";

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
  const {
    timeZone,
    now,
    today,
    date,
    workspaceName,
    rows: allRows,
    types,
    typeFilter,
    selected,
    staff,
    staffFilter,
  } = data;
  const router = useRouter();
  // Filtre par type (puces sous l'en-tête) : appliqué ici, la période est déjà chargée.
  const rows = typeFilter ? allRows.filter((row) => row.typeId === typeFilter) : allRows;

  // Période affichée et navigation.
  const { days, previous, next } = calendarPeriod(view, date);
  // Sens de la navigation (comparé à l'affichage précédent) : les textes glissent de ce côté.
  const key = civilKey(date);
  const shown = useRef({ view, key });
  const slide =
    shown.current.view !== view
      ? 0
      : key > shown.current.key
        ? 1
        : key < shown.current.key
          ? -1
          : 0;
  useEffect(() => {
    shown.current = { view, key };
  }, [view, key]);
  const first = days[0] ?? date;
  const last = days.at(-1) ?? date;
  const from = startOfDay(first, timeZone);
  const to = startOfDay(addDays(last, 1), timeZone);

  const href = (overrides: {
    vue?: View;
    date?: CivilDate;
    evenement?: string;
    type?: string | null;
  }) =>
    withParams("/app/calendrier", {
      vue: overrides.vue ?? view,
      date: civilKey(overrides.date ?? date),
      evenement: overrides.evenement,
      intervenant: staffFilter,
      type: overrides.type === null ? undefined : (overrides.type ?? typeFilter),
    });
  /** Créer un événement ce jour-là (et à cette heure, depuis un créneau). */
  const createHref = (day: CivilDate, hour?: number) =>
    withParams("/app/evenements/nouveau", {
      date: civilKey(day),
      heure: hour === undefined ? undefined : `${String(hour).padStart(2, "0")}:00`,
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
    // Fiche rapide dans un panneau, sans quitter le calendrier.
    href: href({ evenement: row.id }),
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

  // Retour à la période en cours, nommée selon la vue ; grisé quand on y est déjà.
  const isCurrent =
    view === "mois"
      ? date.year === today.year && date.month === today.month
      : view === "semaine"
        ? showsToday
        : key === civilKey(today);
  const currentLabel =
    view === "mois" ? "Ce mois-ci" : view === "semaine" ? "Cette semaine" : "Aujourd'hui";

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
      {isCurrent ? (
        <span
          aria-current="date"
          className="flex h-[34px] min-w-[104px] items-center justify-center px-3 text-sm font-semibold leading-[18px] text-ink-subtle"
        >
          <Swap value={currentLabel} slide={0}>
            {currentLabel}
          </Swap>
        </span>
      ) : (
        <Link
          href={href({ date: today })}
          className="flex h-[34px] min-w-[104px] items-center justify-center rounded-full px-3 text-sm font-semibold leading-[18px] text-ink hover:bg-field"
        >
          <Swap value={currentLabel} slide={0}>
            {currentLabel}
          </Swap>
        </Link>
      )}
      <Link
        href={href({ date: next })}
        aria-label="Période suivante"
        className="flex size-[34px] items-center justify-center rounded-full text-ink hover:bg-field"
      >
        <ChevronRight />
      </Link>
    </nav>
  );

  // Changer de vue depuis le mois en cours : on part d'aujourd'hui, pas du 1er du mois.
  const anchor =
    view === "mois" && date.year === today.year && date.month === today.month ? today : date;
  const views = [
    { value: "mois", label: "Mois", href: href({ vue: "mois", date: anchor }) },
    { value: "semaine", label: "Semaine", href: href({ vue: "semaine", date: anchor }) },
    { value: "jour", label: "Jour", href: href({ vue: "jour", date: anchor }) },
  ];

  // Raccourcis : ← → période, T aujourd'hui, M S J vue, Échap ferme la fiche. Jamais pendant
  // une saisie ni avec une touche de modification (⌘K reste à la recherche).
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey || event.defaultPrevented) return;
      const target = event.target instanceof Element ? event.target : null;
      if (target?.closest("input, textarea, select, [contenteditable], dialog[open]")) return;
      const key = event.key.length === 1 ? event.key.toLowerCase() : event.key;
      const go: Record<string, string | null> = {
        ArrowLeft: href({ date: previous }),
        ArrowRight: href({ date: next }),
        t: href({ date: today }),
        m: href({ vue: "mois", date: anchor }),
        s: href({ vue: "semaine", date: anchor }),
        j: href({ vue: "jour", date: anchor }),
        Escape: selected ? href({}) : null,
      };
      const destination = go[key];
      if (!destination) return;
      event.preventDefault();
      router.push(destination);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  return (
    <>
      <PageHeader
        eyebrow={
          <>
            <span className="lg:hidden">
              <Swap value={mobileEyebrow} slide={slide}>
                {mobileEyebrow}
              </Swap>
            </span>
            <span className="hidden lg:inline">
              <Swap value={eyebrow} slide={slide}>
                {eyebrow}
              </Swap>
            </span>
          </>
        }
        title={
          <MonthPicker
            year={date.year}
            month={date.month}
            today={today}
            hrefFor={(year, month) => href({ date: { year, month, day: 1 } })}
          >
            <span className="lg:hidden">
              <Swap value={mobileTitle} slide={slide}>
                {mobileTitle}
              </Swap>
            </span>
            <span className="hidden lg:inline">
              <Swap value={title} slide={slide}>
                {title}
              </Swap>
            </span>
          </MonthPicker>
        }
        subtitle={
          <Swap value={`${view}${monthLabel}${summary}`} slide={slide}>
            {view !== "mois" && `${monthLabel} `}
            <span className="text-ink">{summary}</span>
          </Swap>
        }
        toolbar={
          <>
            {staff.length > 0 && (
              <FilterSelect
                param="intervenant"
                label="Intervenant"
                className="w-full sm:w-[200px]"
                options={[
                  { value: "", label: "Tous les intervenants" },
                  ...staff.map((entry) => ({ value: entry.id, label: entry.name })),
                ]}
              />
            )}
            {/* Sur mobile, période et vues sur une ligne, vues en pleine largeur ; sur un petit
                écran (360 px), les vues passent dessous plutôt que de déborder. */}
            <div className="flex flex-wrap gap-3">
              {periodNav}
              <div className="min-w-fit flex-1 sm:hidden">
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

      {/* Filtre par type : les puces servent aussi de légende des couleurs. */}
      {types.length > 1 && (
        <nav
          aria-label="Filtrer par type"
          className="-mt-1 flex gap-2 overflow-x-auto scrollbar-none px-4 pb-3"
        >
          <Link
            href={href({ type: null })}
            aria-current={!typeFilter ? "true" : undefined}
            className={cn(
              TYPE_CHIP,
              !typeFilter ? "bg-ink text-on-ink" : "bg-surface text-ink hover:bg-field",
            )}
          >
            Tous les types
          </Link>
          {types.map((type) => {
            const active = type.id === typeFilter;
            return (
              <Link
                key={type.id}
                href={href({ type: active ? null : type.id })}
                aria-current={active ? "true" : undefined}
                className={cn(
                  TYPE_CHIP,
                  active ? "bg-ink text-on-ink" : "bg-surface text-ink hover:bg-field",
                )}
              >
                <span
                  aria-hidden="true"
                  className="size-2 shrink-0 rounded-[3px]"
                  style={{ backgroundColor: type.color }}
                />
                {type.name}
              </Link>
            );
          })}
        </nav>
      )}

      {/* Changement de vue ou de date : transition de page du routeur (voir router.tsx). */}
      <div className="flex flex-1 flex-col">
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
            {/* Le mois occupe toute la hauteur de l'écran ; ses semaines se partagent la place. */}
            <div className="hidden lg:flex lg:flex-1 lg:flex-col">
              <MonthCalendar
                year={date.year}
                month={date.month}
                events={events}
                timeZone={timeZone}
                today={today}
                moreHref={(day) => href({ vue: "jour", date: day })}
                dayHref={(day) => href({ vue: "jour", date: day })}
                createHref={(day) => createHref(day)}
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
            <div className="hidden lg:flex lg:flex-1 lg:flex-col">
              <TimeGridCalendar
                days={days}
                events={events}
                timeZone={timeZone}
                today={today}
                now={now}
                startHour={startHour}
                endHour={endHour}
                dayHref={(day) => href({ vue: "jour", date: day })}
                slotHref={createHref}
              />
            </div>
          </>
        )}
        {view === "jour" && (
          <div className="flex flex-1 flex-col">
            <TimeGridCalendar
              days={days}
              events={events}
              timeZone={timeZone}
              today={today}
              now={now}
              startHour={startHour}
              endHour={endHour}
              slotHref={createHref}
            />
          </div>
        )}
        {/* Fiche rapide d'un événement, dans toutes les vues : panneau à droite (grand écran),
            feuille qui monte du bas (mobile). */}
        {selected && (
          <Link
            href={href({})}
            aria-label="Fermer le détail"
            className="fixed inset-0 z-40 animate-fade bg-ink/45 lg:bg-ink/20"
          />
        )}
        {selected && (
          <aside
            key={selected.event.id}
            className="fixed inset-x-0 bottom-0 z-50 flex max-h-[85dvh] animate-[rise_380ms_cubic-bezier(0.2,0,0,1)_backwards] flex-col overflow-y-auto rounded-t-3xl bg-surface pb-[env(safe-area-inset-bottom)] lg:inset-x-auto lg:top-[68px] lg:right-4 lg:bottom-4 lg:max-h-none lg:w-[400px] lg:animate-drawer lg:rounded-3xl lg:pb-0 lg:shadow-[0_24px_80px_rgba(0,0,0,0.18)]"
          >
            <div aria-hidden="true" className="flex justify-center pt-2.5 lg:hidden">
              <span className="h-1 w-10 rounded-full bg-line" />
            </div>
            <div className="flex items-start justify-between gap-4 border-b border-line-soft px-6 py-5">
              <div className="flex min-w-0 flex-col gap-3">
                <p className="flex items-center gap-2 text-xs font-bold leading-4 text-ink-muted">
                  <CategorySwatch color={selected.event.typeColor} size={10} />
                  {selected.event.typeName} · {workspaceName}
                </p>
                <h2 className="font-headline text-title-sm text-ink">{selected.event.title}</h2>
                <p className="text-ui font-medium text-ink-muted">
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
                <p className="text-base font-semibold text-ink">{selected.event.locationName}</p>
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
              <ButtonLink href={`/app/evenements/${selected.event.id}/modifier`} className="flex-1">
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
      <FabLink href={newEventHref}>Nouveau</FabLink>
    </>
  );
}
