import { addDays } from "@horaya/core";
import {
  countEventsStartingBetween,
  getDashboardStats,
  listLatestBookings,
  listUpcomingEvents,
} from "@horaya/db";
import type { Metadata } from "next";
import Link from "next/link";
import { FabLink } from "@/components/app/fab";
import { PageHeader } from "@/components/app/page-header";
import { StatusBadge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { DateBlock, EventCell, MoneyCell, PersonCell } from "@/components/ui/cells";
import { EmptyState } from "@/components/ui/empty-state";
import { PlusIcon } from "@/components/ui/icons";
import { SectionHeading } from "@/components/ui/section";
import { Stat, StatGrid } from "@/components/ui/stat";
import { BOOKING_STATUS_BADGE, eventStatusBadge } from "@/components/ui/status";
import { isoWeek, mondayOf, startOfDay, todayIn } from "@/lib/dates";
import { formatTimeRange, formatWeekdayShort, PAYMENT_MODE_LABELS } from "@/lib/format";
import { db } from "@/server/db";
import { getWorkspaceContext } from "@/server/workspace";
import { VerifyEmailBanner } from "./account-actions";

export const metadata: Metadata = { title: "Tableau de bord · Horaya" };

const plural = (count: number, singular: string, pluralForm = `${singular}s`) =>
  `${count} ${count > 1 ? pluralForm : singular}`;

/** Écran 03 : tableau de bord. */
export default async function DashboardPage() {
  const { user, workspace, timeZone } = await getWorkspaceContext();
  const now = new Date();
  const today = todayIn(timeZone, now);
  const monday = mondayOf(today);
  const bounds = {
    now,
    weekStart: startOfDay(monday, timeZone),
    weekEnd: startOfDay(addDays(monday, 7), timeZone),
    previousWeekStart: startOfDay(addDays(monday, -7), timeZone),
    monthStart: startOfDay({ ...today, day: 1 }, timeZone),
  };

  const [stats, upcoming, latest, startingToday] = await Promise.all([
    getDashboardStats(db, workspace.id, bounds),
    listUpcomingEvents(db, workspace.id, now, 8),
    listLatestBookings(db, workspace.id, 8),
    countEventsStartingBetween(
      db,
      workspace.id,
      startOfDay(today, timeZone),
      startOfDay(addDays(today, 1), timeZone),
    ),
  ]);

  const firstName = user.firstName || user.name.split(" ")[0] || "";
  const dateLabel = new Intl.DateTimeFormat("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone,
  }).format(now);
  const weekDiff = stats.eventsThisWeek - stats.eventsLastWeek;
  const subtitleParts = [
    stats.pendingBookings > 0
      ? `${plural(stats.pendingBookings, "réservation")} ${stats.pendingBookings > 1 ? "attendent" : "attend"} ta validation`
      : null,
    startingToday > 0
      ? `${plural(startingToday, "événement")} ${startingToday > 1 ? "démarrent" : "démarre"} aujourd'hui`
      : null,
  ].filter(Boolean);

  return (
    <>
      <PageHeader
        eyebrow={`${dateLabel} · Semaine ${isoWeek(today)}`}
        title={`Bonjour, ${firstName}`}
        subtitle={
          subtitleParts.length > 0
            ? `${subtitleParts.join(" et ")}.`
            : `Rien d'urgent dans ${workspace.name}.`
        }
        actions={
          <>
            <ButtonLink href="/app/calendrier" variant="secondary">
              Voir le calendrier
            </ButtonLink>
            <div className="hidden lg:flex">
              <ButtonLink href="/app/evenements/nouveau" icon={<PlusIcon />}>
                Nouvel événement
              </ButtonLink>
            </div>
          </>
        }
      />
      {!user.emailVerified && (
        <div className="border-b-2 border-ink px-4 py-6 sm:px-10">
          <VerifyEmailBanner email={user.email} />
        </div>
      )}

      <StatGrid>
        <Stat
          label="Événements cette semaine"
          value={stats.eventsThisWeek}
          footer={
            weekDiff === 0
              ? "Comme la semaine dernière"
              : `${weekDiff > 0 ? "▲ +" : "▼ "}${weekDiff} vs semaine dernière`
          }
          footerTone={weekDiff > 0 ? "success" : weekDiff < 0 ? "danger" : "muted"}
        />
        <Stat
          label="Réservations"
          value={stats.activeBookings}
          footer={`▲ +${stats.bookingsThisMonth} ce mois-ci`}
          footerTone={stats.bookingsThisMonth > 0 ? "success" : "muted"}
        />
        <Stat
          label="Taux de remplissage"
          value={stats.fillRate === null ? "—" : `${stats.fillRate}%`}
          footer="Événements publiés à venir"
        />
        <Stat
          label="À valider"
          value={stats.pendingBookings}
          highlight={stats.pendingBookings > 0}
          footer={
            stats.pendingBookings > 0 ? (
              <Link
                href="/app/reservations?statut=pending"
                className="font-bold underline decoration-1 underline-offset-[3px]"
              >
                Traiter maintenant →
              </Link>
            ) : (
              "Tout est à jour"
            )
          }
        />
      </StatGrid>

      {upcoming.length === 0 && latest.length === 0 ? (
        <EmptyState
          title="Rien à l'agenda. Pour l'instant."
          description="Crée ton premier événement : il apparaîtra dans ton calendrier et sur ta page publique, prêt à recevoir des réservations."
          actions={
            <ButtonLink href="/app/evenements/nouveau" arrow>
              Créer mon premier événement
            </ButtonLink>
          }
          steps={["Crée un événement", "Partage ta page publique", "Reçois tes réservations"]}
        />
      ) : (
        <div className="grid flex-1 grid-cols-[minmax(0,1fr)] xl:grid-cols-2">
          <section className="border-ink xl:border-r-2">
            <SectionHeading
              title="À venir"
              action={{ label: "Tous les événements", href: "/app/evenements" }}
            />
            {upcoming.length === 0 ? (
              <p className="px-4 py-8 text-base font-medium text-ink-muted sm:px-10">
                Aucun événement à venir.
              </p>
            ) : (
              <ul>
                {upcoming.map((event) => {
                  const badge = eventStatusBadge(event.status, event);
                  const remaining =
                    event.capacity === null ? null : Math.max(0, event.capacity - event.seatsHeld);
                  return (
                    <li
                      key={event.id}
                      className="flex items-center gap-5 border-b border-line-soft px-4 py-3.5 sm:pr-8 sm:pl-10"
                    >
                      <DateBlock date={event.startsAt} timeZone={timeZone} />
                      <div className="flex min-w-0 flex-1 flex-col gap-2 sm:flex-row sm:items-center sm:gap-5">
                        <EventCell
                          title={event.title}
                          color={event.typeColor}
                          href={`/app/evenements/${event.id}`}
                          detail={[
                            `${formatWeekdayShort(event.startsAt, timeZone)} ${formatTimeRange(event.startsAt, event.endsAt, timeZone)}`,
                            event.locationName,
                            remaining === null
                              ? null
                              : `${plural(remaining, "place restante", "places restantes")}`,
                          ]
                            .filter(Boolean)
                            .join(" · ")}
                        />
                        <div className="flex shrink-0 sm:w-[140px] sm:justify-end">
                          <StatusBadge tone={badge.tone}>{badge.label}</StatusBadge>
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
          <section className="border-t-2 border-ink xl:border-t-0">
            <SectionHeading
              title="Dernières réservations"
              action={{ label: "Tout voir", href: "/app/reservations" }}
            />
            {latest.length === 0 ? (
              <p className="px-4 py-8 text-base font-medium text-ink-muted sm:px-10">
                Aucune réservation pour l'instant.
              </p>
            ) : (
              <ul>
                {latest.map((entry) => (
                  <li
                    key={entry.id}
                    className="flex items-center gap-4 border-b border-line-soft px-4 py-3.5 sm:pr-10 sm:pl-8"
                  >
                    <div className="min-w-0 flex-1">
                      <PersonCell
                        name={entry.customerName}
                        detail={`${entry.eventTitle ?? "Location"} · ${plural(entry.seats, "place")}`}
                      />
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-1.5 sm:w-[84px]">
                      <MoneyCell
                        cents={entry.amountCents}
                        caption={PAYMENT_MODE_LABELS[entry.paymentMode]}
                        size="lg"
                      />
                      <div className="sm:hidden">
                        <StatusBadge tone={BOOKING_STATUS_BADGE[entry.status].tone}>
                          {BOOKING_STATUS_BADGE[entry.status].label}
                        </StatusBadge>
                      </div>
                    </div>
                    <div className="hidden w-[130px] shrink-0 justify-end sm:flex">
                      <StatusBadge tone={BOOKING_STATUS_BADGE[entry.status].tone}>
                        {BOOKING_STATUS_BADGE[entry.status].label}
                      </StatusBadge>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      )}
      <FabLink href="/app/evenements/nouveau">Nouvel événement</FabLink>
    </>
  );
}
