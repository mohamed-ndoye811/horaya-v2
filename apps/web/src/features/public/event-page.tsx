import { fieldsOfScope } from "@horaya/core";
import { BottomNotch } from "@/components/app/bottom-notch";
import { FieldAnswers } from "@/components/app/field-answers";
import { WordsReveal } from "@/components/motion/words";
import { eventBadge, eventCover } from "@/components/public/public-events";
import { NotFoundScreen } from "@/components/public/public-not-found";
import { SeatPicker } from "@/components/public/seat-picker";
import { StatusBadge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { ArrowLeft, Check } from "@/components/ui/icons";
import type { getPublicEventPage } from "@/functions/public";
import { cn } from "@/lib/cn";
import { BOOKING_NOUN_LABELS } from "@/lib/fields";
import { displayFontClass } from "@/lib/fonts";
import { formatMoney, formatPublicSchedule } from "@/lib/format";
import { Link } from "@/lib/navigation";
import {
  availability,
  bookingState,
  cancellationPolicy,
  describeRecurrence,
  paymentNote,
} from "@/lib/public-booking";
import { withParams } from "@/lib/search-params";

/** Maquette 5.2 : page publique d'un événement. */
export function PublicEventPage({
  data: { workspace, event, linkSlug, channel, offer, now },
}: {
  data: Awaited<ReturnType<typeof getPublicEventPage>>;
}) {
  const homeHref = linkSlug ? `/${workspace.slug}/calendrier/${linkSlug}` : `/${workspace.slug}`;
  if (!event) {
    return (
      <NotFoundScreen
        wordmark={false}
        title="Cet événement a quitté l'agenda."
        primary={{ label: "Voir les événements à venir", href: homeHref }}
      />
    );
  }
  const tz = workspace.timezone;
  const seats = availability(event.capacity, event.seatsHeld);
  const state = bookingState(event, now);
  const schedule = formatPublicSchedule(event.startsAt, event.endsAt, tz);
  const recurrence = describeRecurrence(event.seriesRule);
  const place = event.locationName ?? (event.onlineUrl ? "En ligne" : "À préciser");
  const bookHref = withParams(`/${workspace.slug}/${event.slug}/reserver`, {
    lien: linkSlug ?? undefined,
  });
  const paragraphs = event.description
    .split(/\n\s*\n/)
    .map((text) => text.trim())
    .filter(Boolean);
  const hasProgram = paragraphs.length > 0 || event.highlights.length > 0;
  const notes = [
    paymentNote(event.paymentMode, channel, event.depositPercent),
    event.requiresApproval ? "Sur validation de l'organisateur" : null,
    event.paymentMode !== "free"
      ? cancellationPolicy(event.startsAt, workspace, tz).split(".")[0]
      : null,
  ].filter(Boolean);
  // Cours vendu seulement au trimestre : on affiche le prix de la série.
  const seriesOnly = event.enrollmentEnabled && !event.dropInAllowed && offer !== null;
  const priceCents = seriesOnly ? (offer?.enrollmentPriceCents ?? 0) : event.priceCents;
  const price = priceCents > 0 ? formatMoney(priceCents) : "Gratuit";
  const ctaLabel =
    state.kind === "waitlist"
      ? "Rejoindre la liste d'attente"
      : event.requiresApproval && event.bookingNoun === "reservation"
        ? "Demander mes places"
        : BOOKING_NOUN_LABELS[event.bookingNoun].action;
  const described = fieldsOfScope(event.fields, "event");

  const badge = eventBadge(state, seats, event.requiresApproval);
  // Cours à l'année : l'organisateur peut réserver la séance à l'unité aux inscrits.
  const dropIn = !event.enrollmentEnabled || event.dropInAllowed;
  const bookable = dropIn && (state.kind === "open" || state.kind === "waitlist");
  const lastSession = offer?.sessions.at(-1);

  return (
    <div className="flex flex-col gap-3.5 sm:gap-6">
      <Link
        href={homeHref}
        className="hidden w-fit items-center gap-1.5 text-sm font-semibold leading-[18px] text-ink-muted hover:text-ink lg:flex"
      >
        <ArrowLeft className="size-3.5" />
        Tous les événements
      </Link>
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
        <div className="flex min-w-0 flex-1 flex-col gap-4">
          <div
            className="flex h-[230px] shrink-0 items-start rounded-[22px] bg-cover bg-center p-3 sm:h-[400px] sm:rounded-3xl"
            style={eventCover(event.coverImageUrl, event.id)}
          >
            <ButtonLink
              href={homeHref}
              variant="secondary"
              size="xs"
              icon={<ArrowLeft className="size-3" />}
              className="lg:hidden"
            >
              Événements
            </ButtonLink>
          </div>
          <div className="flex flex-col gap-3 px-1 pt-2 pb-1">
            <p className="flex flex-wrap items-center gap-2 text-[13px] font-semibold leading-4 text-ink-muted">
              <span
                aria-hidden="true"
                className="size-2 shrink-0 rounded-[3px]"
                style={{ backgroundColor: event.typeColor }}
              />
              {event.typeName}
              {recurrence && <span className="font-medium text-ink-subtle">· {recurrence}</span>}
              {badge && <StatusBadge tone={badge.tone}>{badge.label}</StatusBadge>}
            </p>
            <h1
              className={cn(
                "text-[34px] leading-[38px] tracking-[-0.04em] text-ink sm:text-[52px] sm:leading-[56px]",
                displayFontClass(workspace.displayFont),
              )}
            >
              <WordsReveal>{event.title}</WordsReveal>
            </h1>
          </div>
          {/* Mobile : une carte en lignes (maquette 6.5) ; grand écran : trois cartes (5.2). */}
          <dl className="flex flex-col rounded-[20px] bg-surface px-4 py-0.5 sm:grid sm:grid-cols-3 sm:gap-3 sm:bg-transparent sm:p-0">
            {[
              ["Date", schedule.date],
              ["Horaires", schedule.schedule],
              ["Lieu", place],
            ].map(([label, value]) => (
              <div
                key={label}
                className="flex min-h-[46px] items-center justify-between gap-4 border-t border-bg py-2 first:border-t-0 sm:flex-col sm:items-start sm:justify-start sm:gap-1 sm:rounded-[18px] sm:border-0 sm:bg-surface sm:px-[18px] sm:py-4"
              >
                <dt className="text-[13px] leading-4 text-ink-subtle sm:text-xs sm:font-semibold">
                  {label}
                </dt>
                <dd className="text-right text-sm font-semibold leading-[18px] text-ink sm:text-left sm:text-base sm:leading-5">
                  {value}
                </dd>
              </div>
            ))}
            {seats.ratio !== null && (
              <div className="flex min-h-[46px] items-center justify-between gap-4 border-t border-bg sm:hidden">
                <dt className="text-[13px] leading-4 text-ink-subtle">Places</dt>
                <dd className="flex items-center gap-2">
                  <span aria-hidden="true" className="flex h-1 w-[70px] rounded-full bg-line-soft">
                    <span
                      className={cn("rounded-full", seats.full ? "bg-ink" : "bg-[var(--brand)]")}
                      style={{ width: `${Math.round(seats.ratio * 100)}%` }}
                    />
                  </span>
                  <span className="font-mono text-xs font-semibold text-ink">
                    {event.seatsHeld}/{event.capacity}
                  </span>
                </dd>
              </div>
            )}
          </dl>
          {described.some((field) => event.fieldValues[field.key] !== undefined) && (
            <section className="flex flex-col gap-3 rounded-3xl bg-surface p-6">
              <h2 className="text-xl font-semibold leading-6 text-ink">En pratique</h2>
              <FieldAnswers fields={described} values={event.fieldValues} timeZone={tz} />
            </section>
          )}
          {hasProgram && (
            <section className="flex flex-col gap-3 rounded-3xl bg-surface p-6">
              <h2 className="text-xl font-semibold leading-6 text-ink">Au programme</h2>
              {paragraphs.map((text) => (
                <p
                  key={text.slice(0, 40)}
                  className="whitespace-pre-line text-base leading-[26px] text-ink/85"
                >
                  {text}
                </p>
              ))}
              {event.highlights.length > 0 && (
                <ul className="flex flex-wrap gap-x-6 gap-y-2 pt-1.5">
                  {event.highlights.map((highlight) => (
                    <li
                      key={highlight}
                      className="flex items-center gap-1.5 text-sm font-medium leading-5 text-ink"
                    >
                      <Check size={12} />
                      {highlight}
                    </li>
                  ))}
                </ul>
              )}
            </section>
          )}
        </div>

        <aside
          id="reserver"
          className="flex w-full shrink-0 scroll-mt-20 flex-col gap-[18px] rounded-3xl bg-surface p-6 shadow-[0_1px_2px_rgba(0,0,0,0.05),0_20px_50px_rgba(0,0,0,0.08)] lg:sticky lg:top-[62px] lg:w-[400px]"
        >
          <p className="flex items-baseline gap-1.5">
            <span className="text-[36px] font-medium leading-10 tracking-[-0.03em] text-ink">
              {price}
            </span>
            {priceCents > 0 && (
              <span className="text-[15px] leading-5 text-ink-subtle">
                {seriesOnly ? "le trimestre" : "/ personne"}
              </span>
            )}
          </p>
          <div className="flex flex-col gap-2">
            <p className="flex justify-between gap-3 text-[13px] leading-4">
              <span className="font-semibold text-ink">
                {event.capacity === null
                  ? `${event.seatsHeld} inscrit${event.seatsHeld > 1 ? "s" : ""}`
                  : `${event.seatsHeld} inscrit${event.seatsHeld > 1 ? "s" : ""} sur ${event.capacity}`}
              </span>
              <span
                className={cn(
                  "font-bold",
                  seats.tone === "warning"
                    ? "text-warning"
                    : seats.full
                      ? "text-ink"
                      : "text-success",
                )}
              >
                {seats.label}
              </span>
            </p>
            {seats.ratio !== null && (
              <span aria-hidden="true" className="flex h-1.5 rounded-full bg-line-soft">
                <span
                  className={cn(
                    "origin-left animate-grow-x rounded-full",
                    seats.full ? "bg-ink" : "bg-[var(--brand)]",
                  )}
                  style={{ width: `${Math.round(seats.ratio * 100)}%` }}
                />
              </span>
            )}
          </div>
          {offer && lastSession && (
            <div className="flex flex-col gap-3 border-t border-bg pt-4">
              <div className="flex flex-col gap-1">
                <p className="text-[15px] font-semibold leading-5 text-ink">
                  Inscris-toi pour tout le trimestre
                </p>
                <p className="text-[13px] leading-[18px] text-ink-muted">
                  {offer.sessions.length} séance{offer.sessions.length > 1 ? "s" : ""} ·{" "}
                  {formatMoney(offer.enrollmentPriceCents ?? 0)} · jusqu'au{" "}
                  {formatPublicSchedule(lastSession.startsAt, lastSession.endsAt, tz).date}
                </p>
              </div>
              {offer.fullSessions.length > 0 ? (
                <p className="text-[13px] font-semibold leading-[18px] text-ink-muted">
                  Complet pour le trimestre : il manque une place le{" "}
                  {offer.fullSessions
                    .map(
                      (session) => formatPublicSchedule(session.startsAt, session.endsAt, tz).date,
                    )
                    .join(", le ")}
                  .
                </p>
              ) : (
                <ButtonLink
                  href={`/${workspace.slug}/${event.slug}/inscription`}
                  variant={bookable ? "secondary" : "brand"}
                  arrow
                >
                  M'inscrire au trimestre
                </ButtonLink>
              )}
            </div>
          )}
          {bookable ? (
            <>
              {offer && (
                <p className="-mb-2 text-[13px] font-semibold leading-4 text-ink-subtle">
                  Ou à la séance
                </p>
              )}
              <SeatPicker
                bookHref={bookHref}
                priceCents={event.priceCents}
                maxSeats={state.maxSeats}
                label={ctaLabel}
              />
            </>
          ) : (
            !offer && (
              <p className="border-t border-bg pt-4 text-[15px] font-semibold leading-[22px] text-ink-muted">
                {!dropIn
                  ? "Ce cours se réserve pour toute la série : les inscriptions sont closes."
                  : state.kind === "full"
                    ? "C'est complet : il n'y a plus de place pour cet événement."
                    : "Les réservations en ligne sont closes pour cet événement."}
              </p>
            )
          )}
          <ul className="flex flex-col gap-2 rounded-[14px] bg-field p-3.5 text-[13px] leading-[18px] text-ink/85">
            {(state.kind === "waitlist"
              ? ["C'est complet : ta demande passe en liste d'attente."]
              : notes
            ).map((note) => (
              <li key={note}>{note}</li>
            ))}
          </ul>
        </aside>
      </div>

      {(bookable || offer) && (
        <BottomNotch label="Réserver">
          <p className="flex flex-col gap-px pl-3">
            <span className="text-lg font-semibold leading-[22px] text-on-ink">{price}</span>
            <span className="text-[11px] leading-[14px] text-notch-idle">
              {seriesOnly
                ? "le trimestre"
                : state.kind === "waitlist"
                  ? "liste d'attente"
                  : event.priceCents > 0
                    ? "par personne"
                    : seats.label}
            </span>
          </p>
          <ButtonLink href="#reserver" variant="brand" arrow>
            Réserver
          </ButtonLink>
        </BottomNotch>
      )}
    </div>
  );
}
