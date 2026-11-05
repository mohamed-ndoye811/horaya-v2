import { addDays } from "@horaya/core";
import {
  countEventsStartingBetween,
  getDashboardOverview,
  getDashboardStats,
  getWorkspaceSettings,
  listEventTypes,
  listLatestBookings,
  listUpcomingEvents,
} from "@horaya/db";
import type { Metadata } from "next";
import { FabLink } from "@/components/app/fab";
import { PageHeader } from "@/components/app/page-header";
import { ButtonLink } from "@/components/ui/button";
import { PlusIcon } from "@/components/ui/icons";
import { SectionHeading } from "@/components/ui/section";
import { cumulative, dailySeries, percentChange } from "@/lib/dashboard";
import { addMonths, isoWeek, mondayOf, startOfDay, todayIn } from "@/lib/dates";
import { db } from "@/server/db";
import { getWorkspaceContext } from "@/server/workspace";
import { VerifyEmailBanner } from "./account-actions";
import {
  LatestBookings,
  MonthBand,
  NextDaysCards,
  TodayCard,
  TodoCards,
} from "./dashboard-sections";
import { GettingStarted, type StartStep } from "./getting-started";

export const metadata: Metadata = { title: "Tableau de bord · Horaya" };

const plural = (count: number, singular: string, pluralForm = `${singular}s`) =>
  `${count} ${count > 1 ? pluralForm : singular}`;

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

/** Écran 03 : tableau de bord (DA v4, maquette Paper 1.1). */
export default async function DashboardPage() {
  const { user, workspace, timeZone } = await getWorkspaceContext();
  const now = new Date();
  const today = todayIn(timeZone, now);
  const monday = mondayOf(today);
  const firstOfMonth = { ...today, day: 1 };
  const monthStart = startOfDay(firstOfMonth, timeZone);
  const previousMonthStart = startOfDay(addMonths(today, -1), timeZone);
  const dayStart = startOfDay(today, timeZone);
  const dayEnd = startOfDay(addDays(today, 1), timeZone);

  const [stats, overview, upcoming, latest, startingToday, types, settings] = await Promise.all([
    getDashboardStats(db, workspace.id, {
      now,
      weekStart: startOfDay(monday, timeZone),
      weekEnd: startOfDay(addDays(monday, 7), timeZone),
      previousWeekStart: startOfDay(addDays(monday, -7), timeZone),
      monthStart,
    }),
    getDashboardOverview(db, workspace.id, {
      now,
      dayStart,
      dayEnd,
      monthStart,
      previousMonthStart,
      // Même avancée dans le mois précédent (du 1er au même jour, même heure).
      previousMonthSameMoment: new Date(
        previousMonthStart.getTime() + (now.getTime() - monthStart.getTime()),
      ),
      timeZone,
    }),
    listUpcomingEvents(db, workspace.id, now, 8),
    listLatestBookings(db, workspace.id, 5),
    countEventsStartingBetween(db, workspace.id, dayStart, dayEnd),
    listEventTypes(db, workspace.id),
    getWorkspaceSettings(db, workspace.id),
  ]);

  const nextDays = upcoming.filter((event) => event.startsAt.getTime() < now.getTime() + WEEK_MS);
  const firstName = user.firstName || user.name.split(" ")[0] || "";
  const longDate = (date: Date) =>
    new Intl.DateTimeFormat("fr-FR", {
      weekday: "long",
      day: "numeric",
      month: "long",
      timeZone,
    }).format(date);
  const dateLabel = longDate(now);
  const subtitleParts = [
    startingToday > 0 ? `${plural(startingToday, "événement")} aujourd'hui` : null,
    stats.pendingBookings > 0
      ? `${plural(stats.pendingBookings, "réservation")} ${stats.pendingBookings > 1 ? "attendent" : "attend"} ta validation`
      : null,
  ].filter(Boolean);
  const todoCount =
    overview.pending.count +
    overview.toCollect.count +
    overview.waitlist.count +
    overview.drafts.count;

  const bookingsByDay = dailySeries(overview.month.bookingsByDay, firstOfMonth, today);
  const collectedByDay = dailySeries(overview.month.collectedByDay, firstOfMonth, today);
  const bookingsThisMonth = bookingsByDay.reduce((sum, value) => sum + value, 0);
  const collectedThisMonth = collectedByDay.reduce((sum, value) => sum + value, 0);
  const monthName = new Intl.DateTimeFormat("fr-FR", { month: "long", timeZone });
  const previousMonthName = monthName.format(previousMonthStart);
  const period = `du 1er au ${today.day} ${monthName.format(now)}, comparé à ${previousMonthName}`;

  const empty = upcoming.length === 0 && latest.length === 0;
  const steps: StartStep[] = [
    { label: "Créer ton espace", href: "/app/parametres/organisation", done: true },
    {
      label: "Ajouter ton lien de paiement",
      detail: "Tes clients reçoivent un bouton « Payer » dans chaque confirmation.",
      duration: "1 min",
      href: "/app/parametres/paiements",
      done: Boolean(settings?.paymentLinkUrl),
    },
    {
      label: "Créer un type d'événement",
      detail: "Durée, prix, places : tes futurs événements seront pré-remplis.",
      duration: "1 min",
      href: "/app/evenements/types?type=nouveau",
      done: types.length > 0,
    },
    {
      label: "Créer ton premier événement",
      detail: "Il apparaît dans ton calendrier et sur ta page publique.",
      duration: "2 min",
      href: "/app/evenements/nouveau",
      done: types.some((type) => type.eventCount > 0),
    },
    {
      label: "Partager ta page publique",
      detail: "Envoie le lien à tes clients, ou ajoute-le à ton site.",
      duration: "1 min",
      href: `/${workspace.slug}`,
      done: latest.length > 0,
    },
  ];
  const remaining = steps.filter((step) => !step.done).length;

  return (
    <>
      <PageHeader
        eyebrow={`${dateLabel.charAt(0).toUpperCase()}${dateLabel.slice(1)} · Semaine ${isoWeek(today)}`}
        title={empty ? `Bienvenue, ${firstName}.` : `Bonjour ${firstName}`}
        subtitle={
          empty ? (
            <>
              {workspace.name} est en ligne ·{" "}
              <span className="text-ink">
                {remaining} étape{remaining > 1 ? "s" : ""} avant tes premières réservations
              </span>
            </>
          ) : subtitleParts.length > 0 ? (
            `${subtitleParts.join(". ")}.`
          ) : (
            `Rien d'urgent dans ${workspace.name}.`
          )
        }
        actions={
          <>
            {empty && (
              <ButtonLink href={`/${workspace.slug}`} variant="secondary" target="_blank">
                Ma page publique
              </ButtonLink>
            )}
            <div className="hidden lg:flex">
              <ButtonLink href="/app/evenements/nouveau" icon={<PlusIcon />}>
                Nouvel événement
              </ButtonLink>
            </div>
          </>
        }
      />
      {!user.emailVerified && (
        <div className="px-4 pb-4">
          <VerifyEmailBanner email={user.email} />
        </div>
      )}

      {empty ? (
        <GettingStarted steps={steps} slug={workspace.slug} />
      ) : (
        <div className="flex flex-1 flex-col">
          <div className="grid grid-cols-[minmax(0,1fr)] xl:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]">
            <section className="flex flex-col">
              <SectionHeading title="À faire" meta={plural(todoCount, "action")} />
              <div className="px-4">
                <TodoCards overview={overview} now={now} timeZone={timeZone} />
              </div>
            </section>
            <section className="flex flex-col">
              <SectionHeading
                title="Aujourd'hui"
                meta={dateLabel}
                action={{ label: "Ouvrir le comptoir", href: "/app/reservations/nouvelle" }}
                className="xl:pl-0"
              />
              <div className="px-4 xl:pl-0">
                <TodayCard entries={overview.today} now={now} timeZone={timeZone} />
              </div>
            </section>
          </div>

          {nextDays.length > 0 && (
            <section className="flex flex-col">
              <SectionHeading
                title="7 prochains jours"
                meta={plural(nextDays.length, "événement")}
                action={{ label: "Tous les événements", href: "/app/evenements" }}
              />
              <div className="px-4">
                <NextDaysCards events={nextDays.slice(0, 4)} timeZone={timeZone} />
              </div>
            </section>
          )}

          {latest.length > 0 && (
            <section className="flex flex-col">
              <SectionHeading
                title="Dernières réservations"
                action={{ label: "Toutes les réservations", href: "/app/reservations" }}
              />
              <div className="px-4">
                <LatestBookings bookings={latest} now={now} />
              </div>
            </section>
          )}

          {/* La bande « Ce mois-ci » reste collée au bas du cadre, même sur une page courte. */}
          <div aria-hidden="true" className="h-6 shrink-0" />
          <MonthBand
            period={period}
            bookings={bookingsThisMonth}
            bookingsDelta={percentChange(bookingsThisMonth, overview.month.previousBookings)}
            bookingsCurve={cumulative(bookingsByDay)}
            collectedCents={collectedThisMonth}
            collectedDelta={percentChange(
              collectedThisMonth,
              overview.month.previousCollectedCents,
            )}
            collectedBars={collectedByDay}
            fillRate={stats.fillRate}
          />
        </div>
      )}
      <FabLink href="/app/evenements/nouveau">Nouvel événement</FabLink>
    </>
  );
}
