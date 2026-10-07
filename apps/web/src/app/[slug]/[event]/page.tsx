import { getPublicEvent } from "@horaya/db";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AvailabilityMeter } from "@/components/public/availability-meter";
import { BrandBand, brandRule, PublicNav } from "@/components/public/public-chrome";
import { NotFoundScreen } from "@/components/public/public-not-found";
import { SeatPicker } from "@/components/public/seat-picker";
import { ArrowRight, Check } from "@/components/ui/icons";
import { cn } from "@/lib/cn";
import { displayFontClass } from "@/lib/fonts";
import { formatMoney, formatPublicSchedule } from "@/lib/format";
import {
  availability,
  bookingState,
  cancellationPolicy,
  describeRecurrence,
} from "@/lib/public-booking";
import { db } from "@/server/db";
import { getWorkspaceBySlug } from "@/server/public";

const PAYMENT_NOTES: Record<string, string> = {
  free: "Gratuit",
  on_site: "Paiement sur place",
  online: "Paiement auprès de l'organisateur",
  deposit: "Paiement auprès de l'organisateur",
};

async function load(params: PageProps<"/[slug]/[event]">["params"]) {
  const { slug, event: eventSlug } = await params;
  const workspace = await getWorkspaceBySlug(slug);
  if (!workspace) notFound();
  const event = await getPublicEvent(db, workspace.id, eventSlug);
  return { workspace, event };
}

export async function generateMetadata({
  params,
}: PageProps<"/[slug]/[event]">): Promise<Metadata> {
  const { workspace, event } = await load(params);
  return {
    title: event
      ? `${event.title} · ${workspace.name}`
      : `Événement introuvable · ${workspace.name}`,
    description: event?.description.slice(0, 160) || undefined,
  };
}

/** Écran 10 : page publique d'un événement. */
export default async function PublicEventPage({ params }: PageProps<"/[slug]/[event]">) {
  const { workspace, event } = await load(params);
  if (!event) {
    return (
      <NotFoundScreen
        wordmark={false}
        title="Cet événement a quitté l'agenda."
        primary={{ label: "Voir les événements à venir", href: `/${workspace.slug}` }}
      />
    );
  }
  const tz = workspace.timezone;
  const now = new Date();
  const seats = availability(event.capacity, event.seatsHeld);
  const state = bookingState(event, now);
  const schedule = formatPublicSchedule(event.startsAt, event.endsAt, tz);
  const recurrence = describeRecurrence(event.seriesRule);
  const place = event.locationName ?? (event.onlineUrl ? "En ligne" : "À préciser");
  const bookHref = `/${workspace.slug}/${event.slug}/reserver`;
  const paragraphs = event.description
    .split(/\n\s*\n/)
    .map((text) => text.trim())
    .filter(Boolean);
  const notes = [
    PAYMENT_NOTES[event.paymentMode],
    event.requiresApproval ? "Sur validation de l'organisateur" : null,
    event.paymentMode !== "free"
      ? cancellationPolicy(event.startsAt, workspace, tz).split(".")[0]
      : null,
  ].filter(Boolean);
  const price = event.priceCents > 0 ? formatMoney(event.priceCents) : "Gratuit";
  const ctaLabel =
    state.kind === "waitlist"
      ? "Rejoindre la liste d'attente"
      : event.requiresApproval
        ? "Demander mes places"
        : "Réserver mes places";

  return (
    <>
      <BrandBand>
        <PublicNav workspace={workspace} />
        <div className="flex flex-col gap-6 px-5 pt-8 pb-8 sm:px-16 sm:pt-14 sm:pb-16">
          <div className="flex flex-wrap gap-2">
            <span className="flex h-7 items-center bg-[var(--on-brand)] px-2.5 font-mono text-label font-semibold uppercase tracking-[0.055em] text-[var(--brand)]">
              {event.typeName}
            </span>
            {recurrence && (
              <span className="flex h-7 items-center border-[1.5px] border-[var(--on-brand)] px-2.5 font-mono text-label font-semibold uppercase tracking-[0.055em]">
                {recurrence}
              </span>
            )}
          </div>
          <h1
            className={cn(
              "text-[52px] leading-[48px] sm:text-[112px] sm:leading-[100px]",
              displayFontClass(workspace.displayFont),
            )}
          >
            {event.title}
          </h1>
          <p className="text-base font-medium leading-6 opacity-90 sm:text-lg sm:leading-[26px]">
            Organisé par {workspace.name}
            {event.seatsHeld > 0 &&
              ` · ${event.seatsHeld} inscrit${event.seatsHeld > 1 ? "s" : ""}`}
          </p>
        </div>
        <dl className={cn("grid border-t sm:grid-cols-3", brandRule)}>
          {[
            ["Date", schedule.date],
            ["Horaires", schedule.schedule],
            ["Lieu", place],
          ].map(([label, value], index) => (
            <div
              key={label}
              className={cn(
                "flex flex-col gap-2 px-5 py-4 sm:py-6",
                index === 0 ? "sm:pl-16" : "sm:px-8",
                index === 2 && "sm:pr-16",
                index < 2 && cn("border-b sm:border-r sm:border-b-0", brandRule),
              )}
            >
              <dt className="font-mono text-label font-semibold uppercase tracking-[0.055em] opacity-80">
                {label}
              </dt>
              <dd className="text-lg font-bold leading-6 sm:text-xl sm:leading-[26px]">{value}</dd>
            </div>
          ))}
        </dl>
      </BrandBand>

      <div className="flex flex-col gap-10 px-5 pt-8 pb-28 sm:px-16 sm:pt-14 lg:flex-row lg:items-start lg:gap-14 lg:pb-[72px]">
        <div className="flex min-w-0 flex-1 flex-col gap-5 [&>*]:max-w-[680px]">
          {event.capacity !== null && (
            <div className="lg:hidden">
              <AvailabilityMeter
                label={seats.label}
                tone={seats.tone}
                ratio={seats.ratio}
                count={`${event.seatsHeld} / ${event.capacity}`}
              />
            </div>
          )}
          <h2 className="font-section text-[28px] leading-8 text-ink">Au programme</h2>
          {paragraphs.length > 0 ? (
            paragraphs.map((text) => (
              <p
                key={text.slice(0, 40)}
                className="whitespace-pre-line text-base font-medium leading-7 text-ink sm:text-lg sm:leading-[29px]"
              >
                {text}
              </p>
            ))
          ) : (
            <p className="text-lg font-medium text-ink-muted">
              Le programme détaillé arrive bientôt.
            </p>
          )}
          {event.highlights.length > 0 && (
            <ul className="flex flex-wrap gap-2.5 pt-1">
              {event.highlights.map((highlight) => (
                <li
                  key={highlight}
                  className="flex h-9 items-center gap-2 border-[1.5px] border-ink px-3.5 text-sm font-semibold text-ink"
                >
                  <Check size={12} />
                  {highlight}
                </li>
              ))}
            </ul>
          )}
        </div>

        <aside
          id="reserver"
          className="flex w-full shrink-0 scroll-mt-6 flex-col border-2 border-ink bg-surface lg:w-[400px]"
        >
          <div className="flex items-baseline gap-2 px-6 pt-6 pb-4">
            <span className="font-headline text-[48px] leading-[48px] text-ink">{price}</span>
            {event.priceCents > 0 && (
              <span className="text-[15px] font-semibold text-ink-muted">/ personne</span>
            )}
          </div>
          <div className="border-b border-line-soft px-6 pb-5">
            <AvailabilityMeter
              label={seats.label}
              tone={seats.tone}
              ratio={seats.ratio}
              count={event.capacity === null ? undefined : `${event.seatsHeld} / ${event.capacity}`}
              thick
            />
          </div>
          {state.kind === "open" || state.kind === "waitlist" ? (
            <SeatPicker
              bookHref={bookHref}
              priceCents={event.priceCents}
              maxSeats={state.maxSeats}
              label={ctaLabel}
            />
          ) : (
            <p className="px-6 pt-5 text-[15px] font-semibold text-ink-muted">
              {state.kind === "full"
                ? "C'est complet : il n'y a plus de place pour cet événement."
                : "Les réservations en ligne sont closes pour cet événement."}
            </p>
          )}
          <p className="px-6 pt-3 pb-6 text-center text-[13px] font-medium leading-[18px] text-ink-muted">
            {state.kind === "waitlist"
              ? "C'est complet : ta demande passe en liste d'attente."
              : notes.join(" · ")}
          </p>
        </aside>
      </div>

      {(state.kind === "open" || state.kind === "waitlist") && (
        <div className="fixed inset-x-0 bottom-0 z-30 flex items-center justify-between gap-4 border-t-2 border-ink bg-surface px-5 py-4 lg:hidden">
          <div className="flex flex-col">
            <span className="flex items-baseline gap-1.5">
              <span className="font-headline text-[32px] leading-8 text-ink">{price}</span>
              {event.priceCents > 0 && (
                <span className="text-sm font-semibold text-ink-muted">/ pers.</span>
              )}
            </span>
            <span
              className={cn(
                "text-[13px] font-bold",
                seats.tone === "warning" ? "text-warning" : "text-success",
              )}
            >
              {seats.full ? "Liste d'attente" : seats.label}
            </span>
          </div>
          <Link
            href="#reserver"
            className="flex h-[52px] items-center gap-2.5 bg-ink px-6 text-base font-extrabold text-on-ink"
          >
            Réserver
            <ArrowRight />
          </Link>
        </div>
      )}
    </>
  );
}
