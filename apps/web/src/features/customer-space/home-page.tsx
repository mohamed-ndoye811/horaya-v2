import { type ReactNode, useState } from "react";
import { ActionBar } from "@/components/ui/action-bar";
import { StatusBadge } from "@/components/ui/badge";
import { Button, ButtonLink } from "@/components/ui/button";
import { CalendarIcon, UsersIcon } from "@/components/ui/icons";
import type { getCustomerHome } from "@/functions/customer-space";
import { bookingBadge, historySummary } from "@/lib/customer-space";
import { formatDayNumber, formatRelativeDay, formatTimeRange } from "@/lib/format";
import { FeedButton, PayAction } from "./actions";
import { BookingCard, BookingRow, bookingDetails, bookingHref } from "./booking-card";
import { SpaceTitle } from "./space-layout";

/**
 * Points d'accroche des lots 30 à 32. Chaque bloc n'est rendu que si la route le fournit, et
 * la route ne le fournit que si ses données existent : le lot 29 seul n'en affiche aucun.
 */
export interface CustomerHomeSlots {
  /** Lot 30 : « Ton trimestre » à droite du prochain cours (sinon la carte prend toute la largeur). */
  term?: ReactNode;
  /** Lot 30 : actions en plus sur le prochain cours (« Je serai absente »). */
  nextActions?: ReactNode;
  /** Lots 31 et 32 : carte de séances, bons cadeaux, en tête de la colonne de droite. */
  aside?: ReactNode;
  /** Lot 31 : solde de la carte, à gauche de « Réserver » dans la barre du bas (mobile). */
  barMessage?: ReactNode;
}

const weekday = (date: Date, timeZone: string) =>
  new Intl.DateTimeFormat("fr-FR", { timeZone, weekday: "long" }).format(date);
const month = (date: Date, timeZone: string) =>
  new Intl.DateTimeFormat("fr-FR", { timeZone, month: "long" }).format(date);

/** Maquettes 8.2 (grand écran) et 8.6 (mobile) : l'accueil de l'espace client chez un atelier. */
export function CustomerHomePage({
  workspace,
  data,
  slots = {},
}: {
  workspace: { name: string; slug: string; displayFont: string; timezone: string };
  data: Awaited<ReturnType<typeof getCustomerHome>>;
  slots?: CustomerHomeSlots;
}) {
  const { account, upcoming, history, now, feedUrl, freeCancellationHours } = data;
  const [showHistory, setShowHistory] = useState(false);
  const tz = workspace.timezone;
  const [next, ...later] = upcoming;
  const count = upcoming.length;
  const intro =
    count === 0
      ? `Rien à venir chez ${workspace.name} pour l'instant.`
      : `${count} réservation${count > 1 ? "s" : ""} à venir chez ${workspace.name}.${
          next?.startsAt ? ` La prochaine, c'est ${nextDay(next.startsAt, tz, now)}.` : ""
        }`;
  const book = `/${workspace.slug}`;

  return (
    <div className="flex flex-col gap-4 pb-20 lg:flex-row lg:items-start lg:pb-0">
      <section className="flex min-w-0 flex-1 flex-col gap-6 lg:gap-9 lg:rounded-3xl lg:bg-surface lg:px-11 lg:pt-10 lg:pb-11">
        <div className="flex items-end justify-between gap-6 pt-3.5 lg:pt-0">
          <div className="flex flex-col gap-1 sm:gap-2">
            <SpaceTitle displayFont={workspace.displayFont}>
              Bonjour{account.firstName ? ` ${account.firstName}` : ""}
            </SpaceTitle>
            <p className="text-[15px] leading-[22px] text-ink-muted sm:text-base sm:leading-6">
              {intro}
            </p>
          </div>
          <ButtonLink href={book} variant="brand" arrow className="max-lg:hidden">
            Réserver un cours
          </ButtonLink>
        </div>

        {slots.aside && <div className="flex flex-col gap-4 lg:hidden">{slots.aside}</div>}

        {next ? (
          <div className="flex flex-col gap-4">
            <div className="flex items-baseline justify-between gap-4 max-lg:hidden">
              <h2 className="text-lg font-semibold leading-6 text-ink">À venir</h2>
              {freeCancellationHours > 0 && (
                <p className="text-[13px] leading-4 text-ink-subtle">
                  Annulation gratuite jusqu'à {freeCancellationHours} h avant
                </p>
              )}
            </div>

            {/* Mobile (8.6) : une liste compacte, chaque ligne mène à la réservation. */}
            <div className="flex flex-col rounded-[20px] bg-surface px-4 py-1 lg:hidden">
              {upcoming.map((card) => (
                <BookingRow key={card.id} card={card} />
              ))}
            </div>

            <div className="flex gap-6 rounded-[20px] bg-bg p-6 max-lg:hidden">
              {next.startsAt && (
                <div className="flex w-24 shrink-0 flex-col items-center justify-center rounded-2xl bg-surface py-3.5">
                  <span className="text-xs font-bold uppercase leading-4 tracking-[0.06em] text-[var(--brand-text)]">
                    {weekday(next.startsAt, tz)}
                  </span>
                  <span className="text-[40px] font-medium leading-[44px] tracking-[-0.03em] text-ink">
                    {formatDayNumber(next.startsAt, tz)}
                  </span>
                  <span className="text-[13px] leading-4 text-ink-muted">
                    {month(next.startsAt, tz)}
                  </span>
                </div>
              )}
              <div
                className={
                  slots.term
                    ? "flex min-w-0 flex-1 flex-col justify-between gap-4"
                    : "flex min-w-0 flex-1 items-center justify-between gap-6"
                }
              >
                <div className="flex min-w-0 flex-col gap-1.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-[13px] font-semibold leading-4 text-ink-muted">
                      Ta prochaine réservation
                    </p>
                    {(() => {
                      const badge = bookingBadge(next);
                      return badge.label === "Confirmée" ? null : (
                        <StatusBadge tone={badge.tone}>{badge.label}</StatusBadge>
                      );
                    })()}
                  </div>
                  <h3 className="text-[26px] font-semibold leading-8 tracking-[-0.02em] text-ink">
                    {next.title}
                  </h3>
                  <p className="text-[15px] leading-[22px] text-ink-muted">
                    {next.startsAt && next.endsAt
                      ? `${formatTimeRange(next.startsAt, next.endsAt, tz)} · ${next.seats} place${next.seats > 1 ? "s" : ""}`
                      : bookingDetails(next)}
                    {next.locationName ? ` · ${next.locationName}` : ""}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {next.pay && (
                    <PayAction slug={workspace.slug} bookingId={next.id} pay={next.pay} />
                  )}
                  <ButtonLink href={bookingHref(next)} size="sm">
                    Voir la réservation
                  </ButtonLink>
                  {slots.nextActions}
                </div>
              </div>
              {slots.term && <div className="w-[280px] shrink-0">{slots.term}</div>}
            </div>

            {later.length > 0 && (
              <div className="grid gap-4 max-lg:hidden xl:grid-cols-2">
                {later.map((card) => (
                  <BookingCard key={card.id} card={card} />
                ))}
              </div>
            )}
          </div>
        ) : (
          <div className="flex flex-col items-start gap-4 rounded-[20px] bg-bg p-6">
            <p className="text-[15px] leading-[22px] text-ink-muted">
              Tes prochaines réservations chez {workspace.name} apparaîtront ici.
            </p>
            <ButtonLink href={book} variant="brand" size="sm" arrow>
              Voir les événements
            </ButtonLink>
          </div>
        )}

        <div className="flex flex-col gap-3 rounded-2xl bg-bg px-5 py-4 max-lg:bg-surface">
          <div className="flex items-center justify-between gap-4">
            <div className="flex flex-col gap-0.5">
              <h2 className="text-[15px] font-semibold leading-5 text-ink">Historique</h2>
              <p className="text-sm leading-5 text-ink-muted">{historySummary(history, tz)}</p>
            </div>
            {history.length > 0 && (
              <Button
                variant="inverse"
                size="xs"
                aria-expanded={showHistory}
                onClick={() => setShowHistory((value) => !value)}
              >
                {showHistory ? "Masquer" : "Voir l'historique"}
              </Button>
            )}
          </div>
          {showHistory && (
            <div className="flex flex-col rounded-2xl bg-surface px-4 py-1 max-lg:px-0">
              {history.map((card) => (
                <BookingRow key={card.id} card={card} />
              ))}
            </div>
          )}
        </div>
      </section>

      <aside className="flex flex-col gap-4 lg:w-[400px] lg:shrink-0">
        {slots.aside && <div className="flex flex-col gap-4 max-lg:hidden">{slots.aside}</div>}
        <div className="flex flex-col rounded-3xl bg-surface px-5 py-2 sm:px-7">
          <div className="flex items-center gap-3.5 border-b border-line py-4">
            <CalendarIcon className="shrink-0 text-ink" />
            <div className="flex min-w-0 flex-1 flex-col gap-0.5">
              <p className="text-[15px] font-semibold leading-5 text-ink">
                Mes cours dans mon agenda
              </p>
              <p className="text-[13px] leading-[18px] text-ink-muted">
                Google, Apple ou Outlook, mis à jour tout seul
              </p>
            </div>
            <FeedButton url={feedUrl} />
          </div>
          <div className="flex items-center gap-3.5 py-4">
            <UsersIcon className="shrink-0 text-ink" />
            <div className="flex min-w-0 flex-1 flex-col gap-0.5">
              <p className="text-[15px] font-semibold leading-5 text-ink">Mon profil</p>
              <p className="truncate text-[13px] leading-[18px] text-ink-muted">{account.email}</p>
            </div>
            <ButtonLink href={`/${workspace.slug}/mon-espace/profil`} variant="soft" size="xs">
              Modifier
            </ButtonLink>
          </div>
        </div>
      </aside>

      {/* Mobile (8.6) : barre du bas, solde de carte (lot 31) puis « Réserver ». */}
      <div className="lg:hidden">
        <ActionBar message={slots.barMessage}>
          <ButtonLink href={book} variant="brand" arrow>
            Réserver
          </ButtonLink>
        </ActionBar>
      </div>
    </div>
  );
}

/** « mardi », « demain », « aujourd'hui » (dans la semaine), sinon « le 18 novembre ». */
function nextDay(date: Date, timeZone: string, now: Date): string {
  const relative = formatRelativeDay(date, timeZone, now);
  if (relative !== `le ${formatDayNumber(date, timeZone)} ${month(date, timeZone)}`)
    return relative;
  return date.getTime() - now.getTime() < 6 * 86_400_000 ? weekday(date, timeZone) : relative;
}
