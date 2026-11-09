import type { BookingTab } from "@horaya/db";
import { BookingRowActions } from "@/components/app/booking-actions";
import { FabLink } from "@/components/app/fab";
import { FilterSelect } from "@/components/app/filter-select";
import { PageHeader } from "@/components/app/page-header";
import { StatusBadge } from "@/components/ui/badge";
import { Banner } from "@/components/ui/banner";
import { ButtonLink, rowLinkClasses } from "@/components/ui/button";
import { MoneyCell, MonoCaption, PersonCell } from "@/components/ui/cells";
import { DataTable } from "@/components/ui/data-table";
import { EmptyState } from "@/components/ui/empty-state";
import { PlusIcon } from "@/components/ui/icons";
import { ActionMenu } from "@/components/ui/menu";
import { SearchInput } from "@/components/ui/search-input";
import { SegmentedLinks } from "@/components/ui/segmented";
import { bookingStatusBadge } from "@/components/ui/status";
import type { getBookings } from "@/functions/bookings";
import { cn } from "@/lib/cn";
import { elapsed } from "@/lib/dashboard";
import {
  formatDateTimeShort,
  formatMoney,
  formatRelativeDateTime,
  PAYMENT_MODE_LABELS,
} from "@/lib/format";
import { Link, useRouter } from "@/lib/navigation";
import { withParams } from "@/lib/search-params";

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
export function BookingsPage({
  data,
  filters,
}: {
  data: Awaited<ReturnType<typeof getBookings>>;
  filters: { statut?: BookingTab; q?: string; evenement?: string };
}) {
  const router = useRouter();
  const { timeZone, today, counts, bookings, events, monthAmount } = data;
  const tab = filters.statut ?? "all";
  const search = filters.q;
  const eventId = filters.evenement;

  const amountCaption = (row: (typeof bookings)[number]) =>
    row.status === "confirmed" &&
    (row.paymentMode === "online" || row.paymentMode === "deposit") &&
    (row.paymentStatus === "none" || row.paymentStatus === "failed") &&
    row.amountCents > 0
      ? "à payer"
      : PAYMENT_MODE_LABELS[row.paymentMode];

  const exportHref = withParams("/app/reservations/export", {
    statut: tab === "all" ? undefined : tab,
    q: search,
    evenement: eventId,
  });

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
        subtitle={
          <>
            {counts.all} réservation{counts.all > 1 ? "s" : ""}.{" "}
            <span className="text-ink">
              {formatMoney(monthAmount)} confirmés en {MONTHS[today.month - 1]}.
            </span>
          </>
        }
        actions={
          <>
            {/* Sous lg, l'export passe dans un menu « … » (téléchargement : hors du routeur). */}
            <div className="lg:hidden">
              <ActionMenu
                label="Plus d'actions"
                variant="outline"
                items={[
                  { label: "Exporter CSV", onSelect: () => window.location.assign(exportHref) },
                ]}
              />
            </div>
            <div className="hidden gap-2 lg:flex">
              <ButtonLink href={exportHref} variant="secondary" prefetch={false}>
                Exporter CSV
              </ButtonLink>
              <ButtonLink href="/app/reservations/nouvelle" icon={<PlusIcon />}>
                Ajouter une réservation
              </ButtonLink>
            </div>
          </>
        }
        toolbar={
          counts.all > 0 && (
            <>
              <form
                className="min-w-0 lg:flex-1 lg:basis-60 xl:max-w-[260px]"
                onSubmit={(event) => {
                  event.preventDefault();
                  const q = String(new FormData(event.currentTarget).get("q") ?? "").trim();
                  router.push(href({ q: q || undefined }));
                }}
              >
                <SearchInput
                  label="Rechercher une réservation"
                  name="q"
                  defaultValue={search}
                  placeholder="Client, e-mail, référence…"
                />
              </form>
              {/* Sur mobile, les pilules puis la liste des événements. */}
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
                <SegmentedLinks
                  collapse
                  label="Filtrer par statut"
                  value={tab}
                  segments={TABS.map((entry) => ({
                    ...entry,
                    count: counts[entry.value],
                    alert: entry.value === "pending",
                    href: href({ statut: entry.value === "all" ? undefined : entry.value }),
                  }))}
                />
                <FilterSelect
                  param="evenement"
                  label="Événement"
                  className="lg:w-[200px]"
                  options={[
                    { value: "", label: "Tous les événements" },
                    ...events.map((event) => ({ value: event.id, label: event.title })),
                  ]}
                />
              </div>
            </>
          )
        }
      />
      {counts.pending > 0 && tab !== "pending" && (
        <Banner
          action={<Link href={href({ statut: "pending" })}>Afficher uniquement celles-ci</Link>}
        >
          <strong>
            {counts.pending > 1
              ? `${counts.pending} réservations attendent`
              : "1 réservation attend"}{" "}
            ta validation.
          </strong>
          {counts.oldestPendingAt &&
            ` ${counts.pending > 1 ? "La plus ancienne attend" : "Elle attend"} depuis ${elapsed(counts.oldestPendingAt, new Date())}.`}
        </Banner>
      )}

      {counts.all === 0 ? (
        <EmptyState
          title="Ta première réservation t'attend."
          description="Dès qu'un client réserve sur ta page publique, ou que tu inscris quelqu'un toi-même, ça apparaît ici."
          actions={
            <ButtonLink href="/app/reservations/nouvelle" arrow>
              Inscrire quelqu'un
            </ButtonLink>
          }
        />
      ) : (
        <>
          <div className="h-4" />
          <DataTable
            label="Réservations"
            rows={bookings}
            rowKey={(row) => row.id}
            rowHref={(row) => `/app/reservations/${row.id}`}
            minWidth={1060}
            rowTone={(row) =>
              row.status === "pending"
                ? "warning"
                : row.status === "cancelled" || row.status === "refused"
                  ? "muted"
                  : undefined
            }
            empty={
              <p className="px-4 py-10 text-center text-base font-medium text-ink-muted">
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
                      stretched
                    />
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1.5">
                    <MoneyCell cents={row.amountCents} caption={amountCaption(row)} />
                    {row.status !== "pending" && (
                      <StatusBadge tone={bookingStatusBadge(row).tone}>
                        {bookingStatusBadge(row).label}
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
                  <div className="relative z-10 pl-[54px]">
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
                width: 300,
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
                cell: (row) => (
                  <div className="flex min-w-0 flex-col gap-px">
                    {row.eventId ? (
                      <Link
                        href={`/app/evenements/${row.eventId}`}
                        className={cn(rowLinkClasses, "truncate text-sm leading-[18px]")}
                      >
                        {row.eventTitle}
                      </Link>
                    ) : (
                      <Link
                        href={`/app/reservations/${row.id}`}
                        className={cn(rowLinkClasses, "truncate text-sm leading-[18px]")}
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
                key: "date",
                header: "Réservé le",
                width: 150,
                // Entre 1024 et 1279 px, le tableau tient sans défiler.
                hideBelow: "xl",
                cell: (row) => (
                  <span className="text-meta leading-[17px] text-ink-soft">
                    {formatRelativeDateTime(row.createdAt, timeZone)}
                  </span>
                ),
              },
              {
                key: "seats",
                header: "Places",
                width: 80,
                cell: (row) => (
                  <span className="text-sm font-semibold leading-[18px]">{row.seats}</span>
                ),
              },
              {
                key: "amount",
                header: "Montant",
                width: 120,
                align: "right",
                cell: (row) => <MoneyCell cents={row.amountCents} caption={amountCaption(row)} />,
              },
              {
                key: "status",
                header: "Statut",
                width: 150,
                align: "right",
                cell: (row) => (
                  <StatusBadge tone={bookingStatusBadge(row).tone}>
                    {bookingStatusBadge(row).label}
                  </StatusBadge>
                ),
              },
              {
                key: "actions",
                header: <span className="sr-only">Actions</span>,
                width: 104,
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
