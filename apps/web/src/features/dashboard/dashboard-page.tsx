import { daysInMonth } from "@horaya/core";
import { PageHeader } from "@/components/app/page-header";
import { Banner } from "@/components/ui/banner";
import { ButtonLink } from "@/components/ui/button";
import { PlusIcon } from "@/components/ui/icons";
import { SectionHeading } from "@/components/ui/section";
import type { getDashboard } from "@/functions/dashboard";
import { dailySeries } from "@/lib/dashboard";
import { addMonths, isoWeek, startOfDay, todayIn } from "@/lib/dates";
import { initials } from "@/lib/format";
import { Link } from "@/lib/navigation";
import { VerifyEmailBanner } from "./account-actions";
import {
  LatestBookings,
  MobileSummary,
  MonthBand,
  MonthCard,
  NextDaysCards,
  TodayCard,
  TodoCards,
} from "./dashboard-sections";
import { GettingStarted, type StartStep } from "./getting-started";

const plural = (count: number, singular: string, pluralForm = `${singular}s`) =>
  `${count} ${count > 1 ? pluralForm : singular}`;

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

/** Écran 03 : tableau de bord (DA v4, maquette Paper 1.1). */
export function DashboardPage({ data }: { data: Awaited<ReturnType<typeof getDashboard>> }) {
  const {
    user,
    workspace,
    timeZone,
    now,
    stats,
    overview,
    upcoming,
    latest,
    startingToday,
    types,
    paymentLinkUrl,
  } = data;
  const today = todayIn(timeZone, now);
  const firstOfMonth = { ...today, day: 1 };
  const previousMonthStart = startOfDay(addMonths(today, -1), timeZone);
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
  const period = `du 1er au ${today.day} ${monthName.format(now)}`;
  const lastOfMonth = { ...today, day: daysInMonth(today.year, today.month) };
  const monthBookingsByDay = dailySeries(overview.month.bookingsByDay, firstOfMonth, lastOfMonth);
  const monthCollectedByDay = dailySeries(overview.month.collectedByDay, firstOfMonth, lastOfMonth);

  const empty = upcoming.length === 0 && latest.length === 0;
  const steps: StartStep[] = [
    { label: "Créer ton espace", href: "/app/parametres/organisation", done: true },
    {
      label: "Ajouter ton lien de paiement",
      detail: "Tes clients reçoivent un bouton « Payer » dans chaque confirmation.",
      duration: "1 min",
      href: "/app/parametres/paiements",
      done: Boolean(paymentLinkUrl),
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
        mobileEyebrow={`${dateLabel.charAt(0).toUpperCase()}${dateLabel.slice(1)}`}
        className="max-lg:pb-2"
        title={empty ? `Bienvenue, ${firstName}.` : `Bonjour ${firstName}`}
        subtitle={
          empty ? (
            <>
              {workspace.name} est en ligne ·{" "}
              <span className="text-ink">
                {remaining} étape{remaining > 1 ? "s" : ""} avant tes premières réservations
              </span>
            </>
          ) : (
            // Sur mobile, les compteurs disent déjà l'essentiel (maquette 6.1).
            <span className="hidden lg:inline">
              {subtitleParts.length > 0
                ? `${subtitleParts.join(". ")}.`
                : `Rien d'urgent dans ${workspace.name}.`}
            </span>
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
      {(data.billing.over || data.billing.trialUntil) && (
        <div className="pb-4">
          <Banner
            tone={data.billing.suggestUpgrade ? "warning" : "info"}
            action={<Link href="/app/parametres/abonnement">Voir les formules</Link>}
          >
            {data.billing.over ? (
              <>
                <strong>{data.billing.limit} réservations par mois dépassées.</strong> Tes clients
                réservent toujours normalement
                {data.billing.suggestUpgrade
                  ? " ; deux mois de suite, la formule supérieure te correspondrait mieux."
                  : "."}
              </>
            ) : (
              <>
                <strong>Essai Pro jusqu'au {data.billing.trialUntil}.</strong> Ensuite, ton espace
                repasse en Libre sans rien perdre, sauf si tu choisis une formule.
              </>
            )}
          </Banner>
        </div>
      )}

      {empty ? (
        <GettingStarted steps={steps} slug={workspace.slug} />
      ) : (
        <>
          <MobileSummary
            pending={overview.pending.count}
            toCollect={overview.toCollect}
            today={overview.today}
            now={now}
            timeZone={timeZone}
          />
          {/* Dès la tablette, les sections du bureau ; la bande noire du mois attend `lg`. */}
          <div className="hidden flex-1 flex-col md:flex">
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
                <div className="flex flex-1 flex-col px-4 xl:pl-0">
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
                  <NextDaysCards events={nextDays.slice(0, 4)} now={now} timeZone={timeZone} />
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
            <div className="hidden lg:contents">
              <div aria-hidden="true" className="h-6 shrink-0" />
              <MonthBand
                period={period}
                previousMonth={previousMonthName}
                today={today.day}
                bookingsByDay={monthBookingsByDay}
                previousBookings={overview.month.previousBookings}
                collectedByDay={monthCollectedByDay}
                previousCollectedCents={overview.month.previousCollectedCents}
                fillRate={stats.fillRate}
              />
            </div>
          </div>
          <div className="px-4 pt-[18px] lg:hidden">
            <MonthCard
              month={{
                bookings: bookingsThisMonth,
                fillRate: stats.fillRate,
                collectedCents: collectedThisMonth,
              }}
            />
          </div>
        </>
      )}
      <Link
        href="/app/plus"
        aria-label="Compte et paramètres"
        className="absolute top-[30px] right-4 flex size-[38px] items-center justify-center rounded-full bg-accent-gradient text-meta font-bold text-white lg:hidden"
      >
        {user.image ? (
          <img src={user.image} alt="" className="size-full rounded-full object-cover" />
        ) : (
          initials(user.name)
        )}
      </Link>
    </>
  );
}
