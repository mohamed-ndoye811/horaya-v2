import { listPublicEvents } from "@horaya/db";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AvailabilityMeter } from "@/components/public/availability-meter";
import { BrandBand, PublicNav } from "@/components/public/public-chrome";
import { ArrowRight } from "@/components/ui/icons";
import { cn } from "@/lib/cn";
import { displayFontClass } from "@/lib/fonts";
import {
  formatDayNumber,
  formatHour,
  formatMoney,
  formatMonthShort,
  formatPublicSchedule,
  formatWeekdayShort,
} from "@/lib/format";
import { availability, bookingState, pluralize } from "@/lib/public-booking";
import { param, withParams } from "@/lib/search-params";
import { db } from "@/server/db";
import { getWorkspaceBySlug } from "@/server/public";

export async function generateMetadata({ params }: PageProps<"/[slug]">): Promise<Metadata> {
  const workspace = await getWorkspaceBySlug((await params).slug);
  return {
    title: workspace ? `${workspace.name} · Événements` : "Horaya",
    description: workspace?.description ?? undefined,
  };
}

/** Écran 27 : page publique d'un espace, ses événements à venir. */
export default async function PublicWorkspacePage({ params, searchParams }: PageProps<"/[slug]">) {
  const workspace = await getWorkspaceBySlug((await params).slug);
  if (!workspace) notFound();
  const query = await searchParams;
  const now = new Date();
  const events = await listPublicEvents(db, workspace.id, now);
  const tz = workspace.timezone;

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
  const shown = events
    .filter((entry) => !type || entry.typeId === type.id)
    .sort(
      (a, b) =>
        (sort === "prix" ? a.priceCents - b.priceCents : 0) ||
        a.startsAt.getTime() - b.startsAt.getTime(),
    );
  const href = (overrides: Record<string, string | undefined>) =>
    withParams(`/${workspace.slug}`, {
      type: type?.id,
      tri: sort === "date" ? undefined : sort,
      ...overrides,
    });
  const chip = (active: boolean) =>
    cn(
      "flex h-10 shrink-0 items-center gap-2 px-4 text-sm font-bold transition-colors",
      active ? "bg-ink text-on-ink" : "border-2 border-ink text-ink hover:bg-surface",
    );

  return (
    <>
      <BrandBand>
        <PublicNav workspace={workspace} active="events" />
        <div className="flex flex-col gap-6 px-5 pt-8 pb-8 sm:flex-row sm:items-end sm:justify-between sm:gap-16 sm:px-16 sm:py-14">
          <div className="flex min-w-0 flex-col gap-5">
            <p className="font-mono text-label font-semibold uppercase tracking-[0.055em] opacity-85">
              {workspace.name}
            </p>
            <h1
              className={cn(
                "text-[56px] leading-[52px] sm:text-[112px] sm:leading-[100px]",
                displayFontClass(workspace.displayFont),
              )}
            >
              Nos événements
            </h1>
            {workspace.description && (
              <p className="max-w-[620px] text-base font-medium leading-6 opacity-90 sm:text-[19px] sm:leading-7">
                {workspace.description}
              </p>
            )}
          </div>
          <div className="flex shrink-0 items-baseline gap-3 sm:flex-col sm:items-end sm:gap-1">
            <span className="font-headline text-[32px] leading-8 sm:text-display sm:leading-[60px]">
              {events.length}
            </span>
            <span className="font-mono text-label font-semibold uppercase tracking-[0.055em] opacity-85">
              Événement{events.length > 1 ? "s" : ""} à venir
            </span>
          </div>
        </div>
      </BrandBand>

      {events.length === 0 ? (
        <div className="px-5 py-16 sm:px-16">
          <p className="max-w-xl text-lg font-medium text-ink-muted">
            Aucun événement à venir pour l'instant. Reviens bientôt !
          </p>
        </div>
      ) : (
        <>
          <div className="flex items-center justify-between gap-6 border-b-2 border-ink px-5 py-4 sm:px-16 sm:py-6">
            <nav
              aria-label="Filtrer par type"
              className="-mx-1 flex min-w-0 gap-2.5 overflow-x-auto px-1"
            >
              <Link
                href={href({ type: undefined })}
                aria-current={!type ? "page" : undefined}
                className={chip(!type)}
              >
                Tous · {events.length}
              </Link>
              {types.map((entry) => (
                <Link
                  key={entry.id}
                  href={href({ type: entry.id })}
                  aria-current={type?.id === entry.id ? "page" : undefined}
                  className={chip(type?.id === entry.id)}
                >
                  <span
                    aria-hidden="true"
                    className="size-2.5 shrink-0"
                    style={{ backgroundColor: entry.color }}
                  />
                  {pluralize(entry.name)} ·{" "}
                  {events.filter((event) => event.typeId === entry.id).length}
                </Link>
              ))}
            </nav>
            <div className="hidden shrink-0 items-center gap-2.5 text-sm sm:flex">
              <span className="font-semibold text-ink-muted">Trier par</span>
              <Link
                href={href({ tri: undefined })}
                aria-current={sort === "date" ? "true" : undefined}
                className={cn(
                  "text-ink",
                  sort === "date"
                    ? "font-bold underline decoration-1 underline-offset-[3px]"
                    : "font-semibold hover:underline",
                )}
              >
                Date
              </Link>
              <Link
                href={href({ tri: "prix" })}
                aria-current={sort === "prix" ? "true" : undefined}
                className={cn(
                  "text-ink",
                  sort === "prix"
                    ? "font-bold underline decoration-1 underline-offset-[3px]"
                    : "font-semibold hover:underline",
                )}
              >
                Prix
              </Link>
            </div>
          </div>
          <ul className="flex flex-col px-5 pb-10 sm:px-16">
            {shown.map((entry) => {
              const seats = availability(entry.capacity, entry.seatsHeld);
              const state = bookingState(entry, now);
              const eventHref = `/${workspace.slug}/${entry.slug}`;
              const details = [
                formatPublicSchedule(entry.startsAt, entry.endsAt, tz).hours,
                entry.locationName ?? (entry.onlineUrl ? "En ligne" : null),
                ...entry.highlights.slice(0, 1),
              ].filter(Boolean);
              return (
                <li
                  key={entry.id}
                  className="flex flex-col gap-4 border-b border-line-soft py-6 last:border-b-0 lg:flex-row lg:items-center lg:gap-8 lg:py-[22px]"
                >
                  <div className="hidden w-[88px] shrink-0 flex-col gap-1 lg:flex">
                    <span className="font-mono text-label font-semibold uppercase tracking-[0.055em] text-ink-muted">
                      {formatWeekdayShort(entry.startsAt, tz)}{" "}
                      {formatMonthShort(entry.startsAt, tz)}
                    </span>
                    <span className="font-headline text-[52px] leading-[48px] text-ink">
                      {formatDayNumber(entry.startsAt, tz)}
                    </span>
                  </div>
                  <div className="flex min-w-0 flex-1 flex-col gap-2">
                    <p className="flex items-center gap-2.5 font-mono text-label font-semibold uppercase tracking-[0.055em] text-ink-muted lg:hidden">
                      <span
                        aria-hidden="true"
                        className="size-2.5 shrink-0"
                        style={{ backgroundColor: entry.typeColor }}
                      />
                      {formatWeekdayShort(entry.startsAt, tz)} {formatDayNumber(entry.startsAt, tz)}{" "}
                      {formatMonthShort(entry.startsAt, tz)} · {formatHour(entry.startsAt, tz)}
                    </p>
                    <Link
                      href={eventHref}
                      className="flex min-w-0 items-center gap-2.5 text-ink hover:underline"
                    >
                      <span
                        aria-hidden="true"
                        className="hidden size-3 shrink-0 lg:block"
                        style={{ backgroundColor: entry.typeColor }}
                      />
                      <span className="truncate text-lg font-extrabold leading-6 lg:text-section lg:leading-7">
                        {entry.title}
                      </span>
                    </Link>
                    <p className="truncate text-[15px] font-medium leading-5 text-ink-muted">
                      {details.join(" · ")}
                    </p>
                  </div>
                  <div className="lg:w-[170px] lg:shrink-0">
                    <AvailabilityMeter label={seats.label} tone={seats.tone} ratio={seats.ratio} />
                  </div>
                  <div className="flex items-center justify-between gap-4 lg:contents">
                    <div className="flex items-baseline gap-2 lg:w-[110px] lg:shrink-0 lg:flex-col lg:items-end lg:gap-0.5">
                      <span className="text-section font-extrabold leading-[26px] text-ink">
                        {entry.priceCents > 0 ? formatMoney(entry.priceCents) : "Gratuit"}
                      </span>
                      <span className="whitespace-nowrap font-mono text-[11px] font-semibold uppercase tracking-[0.5px] text-ink-muted">
                        {entry.priceCents > 0 ? "/ pers." : "Sur inscription"}
                      </span>
                    </div>
                    <PublicAction href={eventHref} state={state.kind} />
                  </div>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </>
  );
}

function PublicAction({
  href,
  state,
}: {
  href: string;
  state: "open" | "waitlist" | "full" | "closed";
}) {
  const base =
    "flex h-12 w-[150px] shrink-0 items-center justify-center gap-2.5 text-[15px] font-extrabold transition-colors";
  if (state === "open") {
    return (
      <Link href={href} className={cn(base, "bg-ink text-on-ink hover:bg-info")}>
        Réserver
        <ArrowRight />
      </Link>
    );
  }
  if (state === "waitlist") {
    return (
      <Link href={href} className={cn(base, "border-2 border-ink text-ink hover:bg-surface")}>
        Liste d'attente
        <ArrowRight />
      </Link>
    );
  }
  return (
    <Link
      href={href}
      className={cn(base, "border-2 border-ink-subtle text-ink-muted hover:border-ink")}
    >
      {state === "full" ? "Complet" : "Voir"}
    </Link>
  );
}
