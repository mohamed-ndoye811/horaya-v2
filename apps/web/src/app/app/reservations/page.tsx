import {
  type BookingTab,
  countBookingsByTab,
  listBookableEvents,
  listBookings,
  sumConfirmedBookingsSince,
} from "@horaya/db";
import type { Metadata } from "next";
import Link from "next/link";
import { BookingRowActions } from "@/components/app/booking-actions";
import { FabLink } from "@/components/app/fab";
import { FilterSelect } from "@/components/app/filter-select";
import { PageHeader } from "@/components/app/page-header";
import { StatusBadge } from "@/components/ui/badge";
import { Banner } from "@/components/ui/banner";
import { ButtonLink } from "@/components/ui/button";
import { MoneyCell, MonoCaption, PersonCell } from "@/components/ui/cells";
import { DataTable } from "@/components/ui/data-table";
import { EmptyState } from "@/components/ui/empty-state";
import { PlusIcon } from "@/components/ui/icons";
import { SearchInput } from "@/components/ui/search-input";
import { SegmentedLinks } from "@/components/ui/segmented";
import { BOOKING_STATUS_BADGE } from "@/components/ui/status";
import { startOfDay, todayIn } from "@/lib/dates";
import { formatDateTimeShort, formatMoney, PAYMENT_MODE_LABELS } from "@/lib/format";
import { param, withParams } from "@/lib/search-params";
import { db } from "@/server/db";
import { getWorkspaceContext } from "@/server/workspace";

export const metadata: Metadata = { title: "Réservations · Horaya" };

const TABS: Array<{ value: BookingTab; label: string }> = [
  { value: "all", label: "Toutes" },
  { value: "pending", label: "En attente" },
  { value: "confirmed", label: "Confirmées" },
  { value: "waitlisted", label: "Liste d'attente" },
  { value: "cancelled", label: "Annulées" },
];
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

/** Écran 05 : toutes les réservations de l'espace. */
export default async function BookingsPage({ searchParams }: PageProps<"/app/reservations">) {
  const { workspace, timeZone } = await getWorkspaceContext();
  const query = await searchParams;
  const tab = TABS.find((entry) => entry.value === param(query.statut))?.value ?? "all";
  const search = param(query.q);
  const eventId = param(query.evenement);
  const today = todayIn(timeZone);

  const [counts, bookings, events, monthAmount] = await Promise.all([
    countBookingsByTab(db, workspace.id),
    listBookings(db, workspace.id, { tab, search, eventId }),
    listBookableEvents(db, workspace.id, new Date()),
    sumConfirmedBookingsSince(db, workspace.id, startOfDay({ ...today, day: 1 }, timeZone)),
  ]);

  const amountCaption = (row: (typeof bookings)[number]) =>
    row.status === "confirmed" &&
    (row.paymentMode === "online" || row.paymentMode === "deposit") &&
    (row.paymentStatus === "none" || row.paymentStatus === "failed") &&
    row.amountCents > 0
      ? "à payer"
      : PAYMENT_MODE_LABELS[row.paymentMode];

  const href = (overrides: Record<string, string | undefined>) =>
    withParams("/app/reservations", {
      statut: tab === "all" ? undefined : tab,
      q: search,
      evenement: eventId,
      ...overrides,
    });

  return (
    <>
      <PageHeader
        eyebrow="Tableau de bord / Réservations"
        title="Réservations"
        subtitle={`${counts.all} réservation${counts.all > 1 ? "s" : ""} · ${formatMoney(monthAmount)} confirmés en ${MONTHS[today.month - 1]}`}
        actions={
          <>
            <ButtonLink
              href={withParams("/app/reservations/export", {
                statut: tab === "all" ? undefined : tab,
                q: search,
                evenement: eventId,
              })}
              variant="secondary"
              prefetch={false}
            >
              Exporter CSV
            </ButtonLink>
            <div className="hidden lg:flex">
              <ButtonLink href="/app/reservations/nouvelle" icon={<PlusIcon />}>
                Ajouter une réservation
              </ButtonLink>
            </div>
          </>
        }
      />
      {counts.pending > 0 && tab !== "pending" && (
        <Banner
          action={
            <Link
              href={href({ statut: "pending" })}
              className="underline decoration-1 underline-offset-[3px]"
            >
              Afficher uniquement celles-ci
            </Link>
          }
        >
          {counts.pending > 1 ? `${counts.pending} réservations attendent` : "1 réservation attend"}{" "}
          ta validation.
        </Banner>
      )}

      {counts.all === 0 ? (
        <EmptyState
          title="Pas encore de réservation."
          description="Dès qu'un client réserve sur ta page publique, ou que tu inscris quelqu'un toi-même, ça apparaît ici."
          actions={
            <ButtonLink href="/app/reservations/nouvelle" arrow>
              Inscrire quelqu'un
            </ButtonLink>
          }
        />
      ) : (
        <>
          <div className="flex flex-col gap-4 px-4 py-6 sm:px-10 xl:flex-row xl:items-center">
            <form action="/app/reservations" className="xl:flex-1">
              {tab !== "all" && <input type="hidden" name="statut" value={tab} />}
              {eventId && <input type="hidden" name="evenement" value={eventId} />}
              <SearchInput
                label="Rechercher une réservation"
                name="q"
                defaultValue={search}
                placeholder="Client, e-mail, événement, référence…"
              />
            </form>
            <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
              <SegmentedLinks
                label="Filtrer par statut"
                value={tab}
                segments={TABS.map((entry) => ({
                  ...entry,
                  count: counts[entry.value],
                  href: href({ statut: entry.value === "all" ? undefined : entry.value }),
                }))}
              />
            </div>
            <FilterSelect
              param="evenement"
              label="Événement"
              className="xl:w-[220px]"
              options={[
                { value: "", label: "Tous les événements" },
                ...events.map((event) => ({ value: event.id, label: event.title })),
              ]}
            />
          </div>
          <DataTable
            label="Réservations"
            rows={bookings}
            rowKey={(row) => row.id}
            minWidth={1060}
            empty={
              <p className="px-4 py-10 text-center text-base font-medium text-ink-muted sm:px-10">
                Aucune réservation ne correspond à ces filtres.
              </p>
            }
            card={(row) => (
              <div className="flex flex-col gap-3">
                <div className="flex items-center gap-3.5">
                  <div className="min-w-0 flex-1">
                    <PersonCell
                      name={row.customerName}
                      href={`/app/reservations/${row.id}`}
                      detail={`${row.eventTitle ?? "Location"} · ${row.seats} place${row.seats > 1 ? "s" : ""}`}
                    />
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1.5">
                    <MoneyCell cents={row.amountCents} caption={amountCaption(row)} />
                    {row.status !== "pending" && (
                      <StatusBadge tone={BOOKING_STATUS_BADGE[row.status].tone}>
                        {BOOKING_STATUS_BADGE[row.status].label}
                      </StatusBadge>
                    )}
                  </div>
                </div>
                {row.eventStartsAt && (
                  <div className="pl-[54px]">
                    <MonoCaption>{formatDateTimeShort(row.eventStartsAt, timeZone)}</MonoCaption>
                  </div>
                )}
                {row.status === "pending" && (
                  <div className="pl-[54px]">
                    <BookingRowActions
                      bookingId={row.id}
                      customerName={row.customerName}
                      status={row.status}
                      layout="buttons"
                    />
                  </div>
                )}
              </div>
            )}
            columns={[
              {
                key: "client",
                header: "Client",
                cell: (row) => (
                  <PersonCell
                    name={row.customerName}
                    detail={row.customerEmail}
                    href={`/app/reservations/${row.id}`}
                  />
                ),
              },
              {
                key: "event",
                header: "Événement",
                width: 260,
                cell: (row) => (
                  <div className="flex min-w-0 flex-col gap-1">
                    {row.eventId ? (
                      <Link
                        href={`/app/evenements/${row.eventId}`}
                        className="truncate text-sm font-semibold text-ink hover:underline"
                      >
                        {row.eventTitle}
                      </Link>
                    ) : (
                      <Link
                        href={`/app/reservations/${row.id}`}
                        className="truncate text-sm font-semibold text-ink hover:underline"
                      >
                        {row.eventTitle ?? "Location"}
                      </Link>
                    )}
                    {row.eventStartsAt && (
                      <MonoCaption>{formatDateTimeShort(row.eventStartsAt, timeZone)}</MonoCaption>
                    )}
                  </div>
                ),
              },
              {
                key: "seats",
                header: "Places",
                width: 80,
                cell: (row) => <span className="font-mono text-sm font-semibold">{row.seats}</span>,
              },
              {
                key: "amount",
                header: "Montant",
                width: 110,
                align: "right",
                cell: (row) => <MoneyCell cents={row.amountCents} caption={amountCaption(row)} />,
              },
              {
                key: "status",
                header: "Statut",
                width: 160,
                cell: (row) => (
                  <StatusBadge tone={BOOKING_STATUS_BADGE[row.status].tone}>
                    {BOOKING_STATUS_BADGE[row.status].label}
                  </StatusBadge>
                ),
              },
              {
                key: "actions",
                header: "Actions",
                width: 110,
                align: "right",
                cell: (row) => (
                  <BookingRowActions
                    bookingId={row.id}
                    customerName={row.customerName}
                    status={row.status}
                  />
                ),
              },
            ]}
          />
          <FabLink href="/app/reservations/nouvelle">Ajouter</FabLink>
        </>
      )}
    </>
  );
}
