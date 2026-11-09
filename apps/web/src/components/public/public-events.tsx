import type { PublicEventRow } from "@horaya/db";
import type { CSSProperties, ReactNode } from "react";
import { WordsReveal } from "@/components/motion/words";
import { StatusBadge, type Tone } from "@/components/ui/badge";
import { buttonClasses } from "@/components/ui/button";
import { cardShellClasses } from "@/components/ui/section";
import { cn } from "@/lib/cn";
import { meshCover } from "@/lib/cover";
import { displayFontClass } from "@/lib/fonts";
import {
  formatDayNumber,
  formatMoney,
  formatMonthShort,
  formatPublicSchedule,
  formatWeekdayShort,
} from "@/lib/format";
import { Link } from "@/lib/navigation";
import { availability, type BookingState, bookingState, pluralize } from "@/lib/public-booking";
import { param, withParams } from "@/lib/search-params";

/** Image d'un événement, ou un dégradé flou de la couleur de l'espace quand il n'en a pas. */
export function eventCover(imageUrl: string | null, seed: string): CSSProperties {
  return imageUrl ? { backgroundImage: `url(${imageUrl})` } : meshCover("var(--brand)", seed);
}

/** Grand bandeau sombre en tête de page (maquette 5.1). */
export function PublicHero({
  eyebrow,
  title,
  lead,
  font,
  cover,
}: {
  eyebrow?: ReactNode;
  title: string;
  lead?: ReactNode;
  font: string;
  /** Couverture de l'espace ; assombrie vers le bas pour que le titre reste lisible. */
  cover?: string | null;
}) {
  return (
    <section
      className="flex min-h-[260px] flex-col justify-end gap-3.5 rounded-3xl px-6 py-7 text-on-ink lg:h-[340px] lg:px-10 lg:py-9"
      style={{
        background: cover
          ? `linear-gradient(to top, rgba(17, 17, 17, 0.85), rgba(17, 17, 17, 0.1) 75%), center / cover no-repeat url("${cover}"), var(--color-ink)`
          : "radial-gradient(circle at 85% 20%, color-mix(in srgb, var(--brand) 55%, transparent), transparent 60%), var(--color-ink)",
      }}
    >
      {eyebrow && (
        <p className="reveal text-meta font-semibold leading-4 text-[var(--brand-light)]">
          {eyebrow}
        </p>
      )}
      <h1
        className={cn(
          "text-[44px] leading-[48px] tracking-[-0.045em] lg:text-[72px] lg:leading-[72px]",
          displayFontClass(font),
        )}
      >
        <WordsReveal delay={1}>{title}</WordsReveal>
      </h1>
      {lead && (
        <p className="reveal max-w-[520px] text-[17px] leading-[25px] text-on-ink/85">{lead}</p>
      )}
    </section>
  );
}

/** Pastille d'état d'un événement sur sa photo (« Plus que 2 places », « Complet »…). */
export function eventBadge(
  state: BookingState,
  seats: ReturnType<typeof availability>,
  requiresApproval: boolean,
): { label: string; tone: Tone } | null {
  if (state.kind === "closed") return { label: "Réservations closes", tone: "draft" };
  if (state.kind === "upcoming") return { label: "Ouverture prochaine", tone: "info" };
  if (state.kind !== "open") return { label: "Complet", tone: "draft" };
  if (requiresApproval) return { label: "Sur validation", tone: "info" };
  if (seats.tone === "warning") return { label: seats.label, tone: "warning" };
  return null;
}

const ACTIONS: Record<BookingState["kind"], { label: string; className: string }> = {
  open: { label: "Réserver →", className: "text-[var(--brand-text)]" },
  waitlist: { label: "Liste d'attente →", className: "text-ink" },
  full: { label: "Complet", className: "text-ink-subtle" },
  upcoming: { label: "Voir →", className: "text-ink" },
  closed: { label: "Voir →", className: "text-ink-subtle" },
};

/**
 * Événements à venir d'une page publique (maquette 5.1) : filtre par type, tri, cartes pour
 * la semaine, puis une liste pour la suite. Sert aussi aux liens calendrier : `linkSlug`
 * suit le visiteur jusqu'à la réservation.
 */
export function PublicEvents({
  events,
  workspaceSlug,
  timeZone: tz,
  basePath,
  query,
  now,
  linkSlug,
}: {
  events: PublicEventRow[];
  workspaceSlug: string;
  timeZone: string;
  /** Page où restent les filtres (page de l'espace ou du lien). */
  basePath: string;
  query: Record<string, string | string[] | undefined>;
  now: Date;
  linkSlug?: string;
}) {
  const types = [
    ...new Map(
      events.map((entry) => [
        entry.typeId,
        { id: entry.typeId, name: entry.typeName, color: entry.typeColor },
      ]),
    ).values(),
  ];
  const type = types.find((entry) => entry.id === param(query.type));
  const sort = param(query.tri) === "prix" ? "prix" : "date";
  // Filtres publics : champs à choix de « Ce que tu décris » marqués filtre (« Niveau »).
  const filters = [
    ...new Map(
      events.flatMap((entry) =>
        entry.fields
          .filter((field) => field.scope === "event" && field.publicFilter)
          .map((field) => [field.key, { key: field.key, label: field.label }] as const),
      ),
    ).values(),
  ].map((filter) => ({
    ...filter,
    options: [
      ...new Set(
        events.flatMap((entry) => {
          const value = entry.fieldValues[filter.key];
          return Array.isArray(value) ? value : typeof value === "string" ? [value] : [];
        }),
      ),
    ],
  }));
  // ?filtre=niveau:Débutant,technique:Tour
  const selected = new Map(
    (param(query.filtre) ?? "")
      .split(",")
      .map((pair) => pair.split(":") as [string, string?])
      .filter((pair): pair is [string, string] => Boolean(pair[1])),
  );
  const matches = (entry: PublicEventRow) =>
    [...selected].every(([key, wanted]) => {
      const value = entry.fieldValues[key];
      return Array.isArray(value) ? value.includes(wanted) : value === wanted;
    });
  const filterParam = (key: string, value: string | undefined) => {
    const next = new Map(selected);
    if (value === undefined) next.delete(key);
    else next.set(key, value);
    return [...next].map(([name, wanted]) => `${name}:${wanted}`).join(",") || undefined;
  };
  const shown = events
    .filter((entry) => !type || entry.typeId === type.id)
    .filter(matches)
    .sort(
      (a, b) =>
        (sort === "prix" ? a.priceCents - b.priceCents : 0) ||
        a.startsAt.getTime() - b.startsAt.getTime(),
    );
  // Par date : les 7 prochains jours en cartes (ou les 4 premiers), la suite en liste.
  const weekEnd = now.getTime() + 7 * 86_400_000;
  const thisWeek = shown.filter((entry) => entry.startsAt.getTime() < weekEnd);
  const cards = sort === "prix" ? [] : thisWeek.length > 0 ? thisWeek : shown.slice(0, 4);
  const rest = shown.slice(cards.length);

  const href = (overrides: Record<string, string | undefined>) =>
    withParams(basePath, {
      type: type?.id,
      tri: sort === "date" ? undefined : sort,
      filtre: filterParam("", undefined),
      ...overrides,
    });
  const eventHref = (entry: PublicEventRow) =>
    withParams(`/${workspaceSlug}/${entry.slug}`, { lien: linkSlug });
  const chip = (active: boolean) =>
    cn(
      "flex h-[38px] shrink-0 items-center gap-2 rounded-full px-4 text-sm font-semibold leading-[18px] transition-colors",
      active ? "bg-ink text-on-ink" : "bg-surface text-ink hover:bg-field",
    );
  const count = (active: boolean) =>
    cn("font-mono text-[11px] leading-[14px]", active ? "text-on-ink/60" : "text-ink-subtle");
  const sortLink = (active: boolean) =>
    cn(
      "text-sm leading-[18px]",
      active ? "font-semibold text-ink" : "text-ink-subtle hover:text-ink",
    );

  if (events.length === 0) {
    return (
      <div className={cn(cardShellClasses, "items-start gap-2 p-8")}>
        <p className="text-section font-medium leading-[26px] text-ink">
          Aucun événement à venir pour l'instant.
        </p>
        <p className="text-base text-ink-muted">Reviens bientôt !</p>
      </div>
    );
  }

  return (
    <>
      <div className="flex items-center justify-between gap-4">
        <nav
          aria-label="Filtrer par type"
          className="-mx-1 flex min-w-0 gap-1.5 overflow-x-auto px-1 py-1"
        >
          <Link
            href={href({ type: undefined })}
            aria-current={!type ? "page" : undefined}
            className={chip(!type)}
          >
            Tout <span className={count(!type)}>{events.length}</span>
          </Link>
          {types.map((entry) => {
            const active = type?.id === entry.id;
            return (
              <Link
                key={entry.id}
                href={href({ type: entry.id })}
                aria-current={active ? "page" : undefined}
                className={chip(active)}
              >
                <span
                  aria-hidden="true"
                  className="size-2 shrink-0 rounded-[3px]"
                  style={{ backgroundColor: entry.color }}
                />
                {pluralize(entry.name)}
                <span className={count(active)}>
                  {events.filter((event) => event.typeId === entry.id).length}
                </span>
              </Link>
            );
          })}
        </nav>
        <div className="hidden h-[38px] shrink-0 items-center gap-2 rounded-full bg-surface px-3.5 sm:flex">
          <span className="text-meta text-ink-subtle">Trier par</span>
          <Link
            href={href({ tri: undefined })}
            aria-current={sort === "date" ? "true" : undefined}
            className={sortLink(sort === "date")}
          >
            Date
          </Link>
          <Link
            href={href({ tri: "prix" })}
            aria-current={sort === "prix" ? "true" : undefined}
            className={sortLink(sort === "prix")}
          >
            Prix
          </Link>
        </div>
      </div>

      {filters.map((filter) => (
        <nav
          key={filter.key}
          aria-label={`Filtrer par ${filter.label.toLowerCase()}`}
          className="-mx-1 flex min-w-0 items-center gap-1.5 overflow-x-auto px-1 py-1"
        >
          <span className="shrink-0 pr-1 text-meta font-semibold text-ink-subtle">
            {filter.label}
          </span>
          {[undefined, ...filter.options].map((option) => {
            const active = selected.get(filter.key) === option;
            return (
              <Link
                key={option ?? "tout"}
                href={href({ filtre: filterParam(filter.key, option) })}
                aria-current={active ? "page" : undefined}
                className={chip(active)}
              >
                {option ?? "Tous"}
              </Link>
            );
          })}
        </nav>
      ))}

      {shown.length === 0 && (
        <p className={cn(cardShellClasses, "p-6 text-base text-ink-muted")}>
          Aucun événement ne correspond à ces filtres.
        </p>
      )}

      {cards.length > 0 && (
        <section className="flex flex-col gap-3">
          <h2 className="text-section font-medium leading-[26px] tracking-[-0.02em] text-ink">
            {thisWeek.length > 0 ? "Cette semaine" : "Prochainement"}
          </h2>
          <ul className="reveal-group grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {cards.map((entry) => (
              <li key={entry.id} className="flex">
                <EventCard event={entry} href={eventHref(entry)} timeZone={tz} now={now} />
              </li>
            ))}
          </ul>
        </section>
      )}

      {rest.length > 0 && (
        <section className="flex flex-col gap-3">
          <h2 className="text-section font-medium leading-[26px] tracking-[-0.02em] text-ink">
            {sort === "prix" ? "Du moins cher au plus cher" : "Plus tard"}
          </h2>
          <ul className={cn(cardShellClasses, "overflow-hidden")}>
            {rest.map((entry) => (
              <li key={entry.id} className="border-t border-bg first:border-t-0">
                <EventRow event={entry} href={eventHref(entry)} timeZone={tz} />
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}

function EventCard({
  event,
  href,
  timeZone: tz,
  now,
}: {
  event: PublicEventRow;
  href: string;
  timeZone: string;
  now: Date;
}) {
  const seats = availability(event.capacity, event.seatsHeld);
  const state = bookingState(event, now);
  const badge = eventBadge(state, seats, event.requiresApproval);
  const action =
    state.kind === "open" && event.requiresApproval
      ? { ...ACTIONS.open, label: "Demander →" }
      : ACTIONS[state.kind];
  return (
    <Link
      href={href}
      className={cn(
        cardShellClasses,
        "reveal w-full overflow-hidden rounded-[22px] transition-transform hover:-translate-y-0.5",
      )}
    >
      <div
        className={cn(
          "flex h-[180px] shrink-0 items-start justify-between bg-cover bg-center p-3",
          state.kind !== "open" && "opacity-85",
        )}
        style={eventCover(event.coverImageUrl, event.id)}
      >
        <span className="flex w-[52px] shrink-0 flex-col items-center rounded-xl bg-surface py-1.5">
          <span className="text-[11px] font-bold uppercase leading-3 text-[var(--brand-text)]">
            {formatWeekdayShort(event.startsAt, tz)}
          </span>
          <span className="text-section font-semibold leading-6 text-ink">
            {formatDayNumber(event.startsAt, tz)}
          </span>
          <span className="text-[11px] font-semibold uppercase leading-3 text-ink-subtle">
            {formatMonthShort(event.startsAt, tz)}
          </span>
        </span>
        {badge && <StatusBadge tone={badge.tone}>{badge.label}</StatusBadge>}
      </div>
      <div className="flex flex-1 flex-col gap-2.5 px-[18px] pt-4 pb-[18px]">
        <p className="flex items-center gap-2 text-xs font-semibold leading-4 text-ink-subtle">
          <span
            aria-hidden="true"
            className="size-2 shrink-0 rounded-[3px]"
            style={{ backgroundColor: event.typeColor }}
          />
          <span className="truncate">
            {event.typeName} ·{" "}
            {event.seriesKind === "stage"
              ? "plusieurs séances, une inscription"
              : formatPublicSchedule(event.startsAt, event.endsAt, tz).hours}
          </span>
        </p>
        <p className="text-lg font-semibold leading-[22px] tracking-[-0.01em] text-ink">
          {event.title}
        </p>
        {seats.ratio === null ? (
          <p className="text-meta text-ink-subtle">{seats.label}</p>
        ) : (
          <div className="flex items-center gap-2.5">
            <span aria-hidden="true" className="flex h-1 flex-1 rounded-full bg-line-soft">
              <span
                className={cn("rounded-full", seats.full ? "bg-ink" : "bg-[var(--brand)]")}
                style={{ width: `${Math.round(seats.ratio * 100)}%` }}
              />
            </span>
            <span className="font-mono text-[11px] font-semibold leading-[14px] text-ink">
              {event.seatsHeld} / {event.capacity}
            </span>
          </div>
        )}
        <div className="mt-auto flex items-center justify-between pt-0.5">
          <span className="text-ui font-semibold leading-5 text-ink">
            {event.stagePriceCents ? (
              <>
                {formatMoney(event.stagePriceCents)}{" "}
                <span className="font-normal text-ink-subtle">le stage</span>
              </>
            ) : event.priceCents > 0 ? (
              <>
                {formatMoney(event.priceCents)}{" "}
                <span className="font-normal text-ink-subtle">/ pers.</span>
              </>
            ) : (
              "Gratuit"
            )}
          </span>
          <span className={cn("text-sm font-bold leading-[18px]", action.className)}>
            {action.label}
          </span>
        </div>
      </div>
    </Link>
  );
}

function EventRow({
  event,
  href,
  timeZone: tz,
}: {
  event: PublicEventRow;
  href: string;
  timeZone: string;
}) {
  const seats = availability(event.capacity, event.seatsHeld);
  return (
    <Link
      href={href}
      className="group flex items-center gap-[18px] px-5 py-4 transition-colors hover:bg-band lg:h-[72px] lg:py-0"
    >
      <span className="w-24 shrink-0 text-sm font-semibold leading-[18px] text-ink">
        {formatWeekdayShort(event.startsAt, tz)} {formatDayNumber(event.startsAt, tz)}{" "}
        {formatMonthShort(event.startsAt, tz).toLowerCase()}
      </span>
      <span className="hidden w-[110px] shrink-0 font-mono text-xs leading-4 text-ink-subtle lg:block">
        {formatPublicSchedule(event.startsAt, event.endsAt, tz).hours}
      </span>
      <span className="flex min-w-0 flex-1 items-center gap-2.5">
        <span
          aria-hidden="true"
          className="size-2 shrink-0 rounded-[3px]"
          style={{ backgroundColor: event.typeColor }}
        />
        <span className="truncate text-base font-semibold leading-5 text-ink">{event.title}</span>
      </span>
      <span
        className={cn(
          "hidden w-[150px] shrink-0 text-meta leading-4 md:block",
          seats.tone === "warning" ? "font-semibold text-warning" : "text-ink-subtle",
        )}
      >
        {seats.label}
      </span>
      <span className="w-[72px] shrink-0 text-right text-ui font-semibold leading-5 text-ink lg:w-[90px]">
        {event.stagePriceCents
          ? formatMoney(event.stagePriceCents)
          : event.priceCents > 0
            ? formatMoney(event.priceCents)
            : "Gratuit"}
      </span>
      {/* Pas de bouton dans un lien : la pilule n'est qu'un repère visuel. */}
      <span className="hidden shrink-0 sm:block">
        <span className={buttonClasses({ variant: "soft", size: "xs" })}>Voir</span>
      </span>
    </Link>
  );
}
