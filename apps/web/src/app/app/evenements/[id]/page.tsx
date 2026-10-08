import { isCheckInOpen } from "@horaya/core";
import { getEventDetail, listEventItems, listItemsAvailableBetween } from "@horaya/db";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { BookingRowActions, CheckInToggle } from "@/components/app/booking-actions";
import { PageHeader } from "@/components/app/page-header";
import { CategorySwatch } from "@/components/ui/avatar";
import { StatusBadge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { MoneyCell, PersonCell } from "@/components/ui/cells";
import { DataTable } from "@/components/ui/data-table";
import { fillTone, ProgressBar } from "@/components/ui/progress";
import { Eyebrow } from "@/components/ui/section";
import { Stat, StatGrid } from "@/components/ui/stat";
import { BOOKING_STATUS_BADGE, eventStatusBadge } from "@/components/ui/status";
import { Tabs } from "@/components/ui/tabs";
import {
  formatEventRange,
  formatHour,
  formatMoney,
  formatShortDateTime,
  PAYMENT_MODE_LABELS,
} from "@/lib/format";
import { param } from "@/lib/search-params";
import { db } from "@/server/db";
import { getWorkspaceContext } from "@/server/workspace";
import { EventActions } from "./event-actions";
import { EventItems } from "./event-items";

export const metadata: Metadata = { title: "Événement · Horaya" };

/** Écran 15 : fiche d'un événement côté équipe. */
export default async function EventDetailPage({
  params,
  searchParams,
}: PageProps<"/app/evenements/[id]">) {
  const { id } = await params;
  const requested = param((await searchParams).onglet);
  const tab = requested === "infos" || requested === "materiel" ? requested : "participants";
  const { workspace, timeZone } = await getWorkspaceContext();
  const [detail, items] = await Promise.all([
    getEventDetail(db, workspace.id, id),
    listEventItems(db, workspace.id, id),
  ]);
  if (!detail) notFound();

  const { event, bookings, waitlisted, bookedAmountCents } = detail;
  const active = bookings.filter(
    (entry) => entry.status === "pending" || entry.status === "confirmed",
  );
  const pending = bookings.filter((entry) => entry.status === "pending").length;
  const badge = eventStatusBadge(event.status, event);
  const remaining = event.capacity === null ? null : Math.max(0, event.capacity - event.seatsHeld);

  // Check-in : à partir de la veille, la fiche sert à pointer les arrivées.
  const now = new Date();
  const checkIn = event.status === "published" && isCheckInOpen(event, now);
  const confirmed = bookings.filter((entry) => entry.status === "confirmed");
  const arrivals = confirmed.filter((entry) => entry.checkedInAt);
  const seatsArrived = arrivals.reduce((total, entry) => total + entry.seats, 0);
  const seatsConfirmed = confirmed.reduce((total, entry) => total + entry.seats, 0);
  const firstArrival = arrivals.reduce<Date | null>(
    (first, entry) =>
      entry.checkedInAt && (!first || entry.checkedInAt < first) ? entry.checkedInAt : first,
    null,
  );
  const clock = new Intl.DateTimeFormat("fr-FR", { hour: "2-digit", minute: "2-digit", timeZone });

  return (
    <>
      <PageHeader
        eyebrow={`Événements / ${event.title}`}
        title={event.title}
        titleAside={<StatusBadge tone={badge.tone}>{badge.label}</StatusBadge>}
        subtitle={
          <span className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
            <CategorySwatch color={event.typeColor} size={12} />
            {[
              event.typeName,
              formatEventRange(event.startsAt, event.endsAt, timeZone),
              event.locationName ?? (event.onlineUrl ? "En ligne" : null),
            ]
              .filter(Boolean)
              .join(" · ")}
          </span>
        }
        actions={
          <>
            <EventActions eventId={event.id} status={event.status} activeBookings={active.length} />
            {event.status !== "cancelled" && (
              <ButtonLink href={`/app/evenements/${event.id}/modifier`}>Modifier</ButtonLink>
            )}
          </>
        }
      />

      <StatGrid>
        <Stat
          label="Inscrits"
          value={event.seatsHeld}
          suffix={event.capacity !== null ? `/ ${event.capacity}` : undefined}
          footer={
            event.capacity !== null ? (
              <ProgressBar
                value={event.seatsHeld}
                max={event.capacity}
                tone={fillTone(event.seatsHeld, event.capacity)}
                label={`${event.seatsHeld} inscrits sur ${event.capacity}`}
                className="max-w-56"
              />
            ) : (
              "Places illimitées"
            )
          }
        />
        <Stat
          label="Montant réservé"
          value={formatMoney(bookedAmountCents)}
          footer={
            event.paymentMode === "free"
              ? "Événement gratuit"
              : `${PAYMENT_MODE_LABELS[event.paymentMode]} · ${active.length} réservation${active.length > 1 ? "s" : ""}`
          }
        />
        <Stat
          label="Liste d'attente"
          value={waitlisted}
          footer={waitlisted > 0 ? "Prévenus si une place se libère" : "Personne en attente"}
        />
        {checkIn ? (
          <Stat
            label="Taux de présence"
            value={`${seatsArrived} / ${seatsConfirmed}`}
            footer={
              !firstArrival
                ? "Pointe les arrivées dans la liste"
                : event.endsAt > now
                  ? `Check-in en cours depuis ${formatHour(firstArrival, timeZone)}`
                  : `${seatsConfirmed > 0 ? Math.round((seatsArrived / seatsConfirmed) * 100) : 0} % de présence`
            }
          />
        ) : (
          <Stat
            label={pending > 0 ? "À valider" : "Places restantes"}
            value={pending > 0 ? pending : remaining === null ? "∞" : remaining}
            highlight={pending > 0}
            footer={
              pending > 0
                ? "Demandes en attente de ta réponse"
                : event.requiresApproval
                  ? "Validation manuelle"
                  : "Réservation automatique"
            }
          />
        )}
      </StatGrid>

      <div className="border-b-2 border-ink px-4 sm:px-10">
        <Tabs
          label="Sections de l'événement"
          value={tab}
          tabs={[
            {
              value: "participants",
              label: "Participants",
              href: `/app/evenements/${event.id}`,
              count: active.length,
            },
            {
              value: "materiel",
              label: "Matériel",
              href: `/app/evenements/${event.id}?onglet=materiel`,
              count: items.reduce((total, entry) => total + entry.quantity, 0),
            },
            { value: "infos", label: "Infos", href: `/app/evenements/${event.id}?onglet=infos` },
          ]}
        />
      </div>

      {tab === "participants" ? (
        <div className="pt-5">
          <DataTable
            label="Participants"
            rows={bookings}
            rowKey={(row) => row.id}
            dense
            card={(row) => (
              <div className="flex flex-col gap-3">
                <div className="flex items-center gap-3.5">
                  <div className="min-w-0 flex-1">
                    <PersonCell
                      name={row.customerName}
                      href={`/app/reservations/${row.id}`}
                      avatarSize="lg"
                      detail={[
                        `${row.seats} place${row.seats > 1 ? "s" : ""}`,
                        row.customerMessage ? `« ${row.customerMessage} »` : null,
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    />
                  </div>
                  {checkIn && row.status === "confirmed" ? (
                    <CheckInToggle
                      bookingId={row.id}
                      customerName={row.customerName}
                      arrivedAt={row.checkedInAt ? clock.format(row.checkedInAt) : null}
                      size="lg"
                    />
                  ) : (
                    <MoneyCell
                      cents={row.amountCents}
                      caption={PAYMENT_MODE_LABELS[row.paymentMode]}
                    />
                  )}
                </div>
                <div className="flex items-center justify-between gap-3 pl-[54px]">
                  <StatusBadge tone={BOOKING_STATUS_BADGE[row.status].tone}>
                    {BOOKING_STATUS_BADGE[row.status].label}
                  </StatusBadge>
                  {row.status !== "pending" && (
                    <BookingRowActions
                      bookingId={row.id}
                      customerName={row.customerName}
                      status={row.status}
                    />
                  )}
                </div>
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
            empty={
              <p className="px-4 py-10 text-center text-base font-medium text-ink-muted sm:px-10">
                {event.status === "draft"
                  ? "Publie l'événement pour recevoir des réservations."
                  : "Aucune réservation pour l'instant."}
              </p>
            }
            columns={[
              {
                key: "person",
                header: "Participant",
                cell: (row) => (
                  <PersonCell
                    name={row.customerName}
                    href={`/app/reservations/${row.id}`}
                    avatarSize="md"
                    detail={[
                      row.customerEmail,
                      row.customerMessage ? `« ${row.customerMessage} »` : null,
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  />
                ),
              },
              {
                key: "seats",
                header: "Places",
                width: 90,
                cell: (row) => <span className="font-mono text-sm font-semibold">{row.seats}</span>,
              },
              {
                key: "date",
                header: "Réservé le",
                width: 150,
                cell: (row) => (
                  <span className="font-mono text-sm text-ink-muted">
                    {formatShortDateTime(row.createdAt, timeZone)}
                  </span>
                ),
              },
              {
                key: "amount",
                header: "Montant",
                width: 120,
                align: "right",
                cell: (row) => (
                  <MoneyCell
                    cents={row.amountCents}
                    caption={PAYMENT_MODE_LABELS[row.paymentMode]}
                  />
                ),
              },
              ...(checkIn
                ? [
                    {
                      key: "check-in",
                      header: "Check-in",
                      width: 150,
                      cell: (row: (typeof bookings)[number]) =>
                        row.status === "confirmed" ? (
                          <CheckInToggle
                            bookingId={row.id}
                            customerName={row.customerName}
                            arrivedAt={row.checkedInAt ? clock.format(row.checkedInAt) : null}
                          />
                        ) : (
                          <span className="text-[13px] font-semibold text-ink-muted">—</span>
                        ),
                    },
                  ]
                : []),
              {
                key: "status",
                header: "Statut",
                width: 170,
                align: "right",
                cell: (row) => (
                  <StatusBadge tone={BOOKING_STATUS_BADGE[row.status].tone}>
                    {BOOKING_STATUS_BADGE[row.status].label}
                  </StatusBadge>
                ),
              },
              {
                key: "actions",
                header: <span className="sr-only">Actions</span>,
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
        </div>
      ) : tab === "materiel" ? (
        <EventItems
          eventId={event.id}
          reserved={items}
          editable={event.status !== "cancelled" && event.endsAt > new Date()}
          candidates={await listItemsAvailableBetween(db, workspace.id, event, event.id)}
        />
      ) : (
        <div className="grid gap-10 px-4 py-8 sm:px-10 lg:grid-cols-[minmax(0,1fr)_340px]">
          <div className="flex flex-col gap-4">
            <Eyebrow>Description</Eyebrow>
            <p className="whitespace-pre-line text-base font-medium leading-7 text-ink">
              {event.description || (
                <span className="text-ink-muted">Pas encore de description.</span>
              )}
            </p>
          </div>
          <dl className="flex flex-col border-2 border-ink bg-surface">
            {[
              ["Type", event.typeName],
              ["Quand", formatEventRange(event.startsAt, event.endsAt, timeZone)],
              ["Lieu", event.locationName ?? "—"],
              ["Lien de visio", event.onlineUrl ?? "—"],
              ["Visibilité", event.visibility === "public" ? "Public" : "Sur invitation"],
              ["Réservation", event.requiresApproval ? "Validation manuelle" : "Automatique"],
              [
                "Paiement",
                event.paymentMode === "free"
                  ? "Gratuit"
                  : `${PAYMENT_MODE_LABELS[event.paymentMode]} · ${formatMoney(event.priceCents)} / pers.${event.depositPercent ? ` · acompte ${event.depositPercent} %` : ""}`,
              ],
            ].map(([label, value]) => (
              <div
                key={label}
                className="flex flex-col gap-1 border-b border-line-soft px-5 py-3.5 last:border-b-0"
              >
                <dt className="font-mono text-label font-semibold uppercase tracking-[0.055em] text-neutral">
                  {label}
                </dt>
                <dd className="break-words text-[15px] font-semibold text-ink">{value}</dd>
              </div>
            ))}
          </dl>
        </div>
      )}
    </>
  );
}
