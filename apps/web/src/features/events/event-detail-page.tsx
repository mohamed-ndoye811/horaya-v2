import {
  depositLabel,
  fieldsOfScope,
  minimumDecisionAt,
  ruleJournalLine,
  ruleMomentLabel,
  ruleSentence,
} from "@horaya/core";
import { useState, useTransition } from "react";
import { BookingRowActions, CheckInToggle } from "@/components/app/booking-actions";
import { useImageUpload } from "@/components/app/image-upload";
import { PageHeader } from "@/components/app/page-header";
import { CategorySwatch } from "@/components/ui/avatar";
import { StatusBadge } from "@/components/ui/badge";
import { Banner } from "@/components/ui/banner";
import { ButtonLink, textLinkClasses } from "@/components/ui/button";
import { MoneyCell, PersonCell } from "@/components/ui/cells";
import { DataTable } from "@/components/ui/data-table";
import { fillTone, ProgressBar } from "@/components/ui/progress";
import { Eyebrow } from "@/components/ui/section";
import { Stat } from "@/components/ui/stat";
import { bookingStatusBadge, eventStatusBadge } from "@/components/ui/status";
import { Tabs } from "@/components/ui/tabs";
import { SeriesPanel } from "@/features/enrollments/series-panel";
import { type getEvent, keepEventAction } from "@/functions/events";
import { cn } from "@/lib/cn";
import { meshCover } from "@/lib/cover";
import { answerRows } from "@/lib/fields";
import {
  formatEventRange,
  formatHour,
  formatMoney,
  formatOpening,
  formatRelativeDateTime,
  formatShortDateTime,
  PAYMENT_MODE_LABELS,
} from "@/lib/format";
import { Link, useRouter } from "@/lib/navigation";
import { EventActions } from "./event-actions";
import { EventItems } from "./event-items";

/**
 * Seuil de maintien (module Places) pas encore atteint : date de la décision et « Maintenir
 * quand même », qui retire le seuil de cet événement.
 */
function MinimumBanner({
  eventId,
  seats,
  minimum,
  decideAt,
  timeZone,
}: {
  eventId: string;
  seats: number;
  minimum: number;
  decideAt: Date;
  timeZone: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <Banner
      tone={error ? "danger" : "warning"}
      action={
        <button
          type="button"
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              const result = await keepEventAction(eventId);
              if (result.error) setError(result.error);
              else router.refresh();
            })
          }
        >
          {pending ? "Un instant…" : "Maintenir quand même"}
        </button>
      }
    >
      {error ?? (
        <>
          <strong>
            {seats} inscrit{seats > 1 ? "s" : ""} sur {minimum}
          </strong>{" "}
          nécessaires : sans inscriptions d'ici le {formatOpening(decideAt, timeZone)}, l'événement
          sera annulé et chaque inscrit prévenu.
        </>
      )}
    </Banner>
  );
}

/** Écran 15 : fiche d'un événement côté équipe. */
export function EventDetailPage({
  data,
  tab,
}: {
  data: Awaited<ReturnType<typeof getEvent>>;
  tab: "participants" | "materiel" | "infos" | "serie";
}) {
  const { timeZone, now, detail, items, checkIn, candidates, series, ruleRuns } = data;
  const { event, bookings, waitlisted, bookedAmountCents } = detail;
  const active = bookings.filter(
    (entry) => entry.status === "pending" || entry.status === "confirmed",
  );
  const pending = bookings.filter((entry) => entry.status === "pending").length;
  const badge = eventStatusBadge(event.status, event);
  const remaining = event.capacity === null ? null : Math.max(0, event.capacity - event.seatsHeld);

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
  const minimum = event.modules.places?.minimum;
  const decideAt = minimumDecisionAt(event.startsAt, event.modules.places);

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
              event.seriesKind === "stage"
                ? `Séance du stage${event.sessionTopic ? ` : ${event.sessionTopic}` : ""}`
                : event.fromSlot
                  ? "Créneau réservé"
                  : null,
              formatEventRange(event.startsAt, event.endsAt, timeZone),
              event.locationName ?? (event.onlineUrl ? "En ligne" : null),
              event.staffName ? `avec ${event.staffName}` : null,
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

      {minimum && decideAt && event.status === "published" && event.seatsHeld < minimum.seats && (
        <MinimumBanner
          eventId={event.id}
          seats={event.seatsHeld}
          minimum={minimum.seats}
          decideAt={decideAt}
          timeZone={timeZone}
        />
      )}
      <div className="reveal-group grid grid-cols-2 gap-3 px-4 xl:grid-cols-[236px_repeat(4,minmax(0,1fr))]">
        <EventCover id={event.id} cover={event.coverImageUrl} color={event.typeColor} />
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
            dark
            label="Taux de présence"
            badge={
              <span className="flex items-center gap-1.5 rounded-full bg-success/25 px-2 py-0.5 text-[11px] font-bold leading-4 text-success-on-ink">
                <span aria-hidden="true" className="size-1.5 rounded-full bg-success-on-ink" />
                Check-in ouvert
              </span>
            }
            value={seatsArrived}
            suffix={`/ ${seatsConfirmed}`}
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
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 px-4 pt-5 pb-3">
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
            ...(event.seriesId
              ? [
                  {
                    value: "serie",
                    label: event.seriesKind === "stage" ? "Stage" : "Série",
                    href: `/app/evenements/${event.id}?onglet=serie`,
                  },
                ]
              : []),
          ]}
        />
        <p className="text-meta text-ink-muted">
          {[
            event.requiresApproval ? "Validation manuelle" : "Réservation automatique",
            event.paymentMode === "free"
              ? "Gratuit"
              : `${formatMoney(event.priceCents)} / pers. · ${PAYMENT_MODE_LABELS[event.paymentMode]?.toLowerCase()}`,
          ].join(" · ")}
        </p>
      </div>

      {tab === "participants" ? (
        <div>
          <DataTable
            label="Participants"
            rows={bookings}
            rowKey={(row) => row.id}
            rowHref={(row) => `/app/reservations/${row.id}`}
            rowTone={(row) => (row.status === "pending" ? "warning" : undefined)}
            dense
            card={(row) => (
              <div className="flex flex-col gap-3">
                <div className="flex items-center gap-3.5">
                  <div className="min-w-0 flex-1">
                    <PersonCell
                      name={row.customerName}
                      href={`/app/reservations/${row.id}`}
                      avatarSize="lg"
                      stretched
                      detail={[
                        `${row.seats} place${row.seats > 1 ? "s" : ""}`,
                        row.customerMessage ? `« ${row.customerMessage} »` : null,
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    />
                  </div>
                  {checkIn && row.status === "confirmed" ? (
                    <div className="relative z-10">
                      <CheckInToggle
                        bookingId={row.id}
                        customerName={row.customerName}
                        arrivedAt={row.checkedInAt ? clock.format(row.checkedInAt) : null}
                        size="lg"
                      />
                    </div>
                  ) : (
                    <MoneyCell
                      cents={row.amountCents}
                      caption={PAYMENT_MODE_LABELS[row.paymentMode]}
                    />
                  )}
                </div>
                <div className="flex items-center justify-between gap-3 pl-[54px]">
                  <StatusBadge tone={bookingStatusBadge(row).tone}>
                    {bookingStatusBadge(row).label}
                  </StatusBadge>
                  {row.status !== "pending" && (
                    <div className="relative z-10">
                      <BookingRowActions
                        bookingId={row.id}
                        customerName={row.customerName}
                        status={row.status}
                      />
                    </div>
                  )}
                </div>
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
            empty={
              <p className="px-4 py-10 text-center text-base font-medium text-ink-muted">
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
                cell: (row) => <span className="text-sm font-semibold">{row.seats}</span>,
              },
              {
                key: "date",
                header: "Réservé le",
                width: 130,
                cell: (row) => (
                  <span className="text-sm text-ink-muted">
                    {formatRelativeDateTime(row.createdAt, timeZone)}
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
                          <span className="text-meta font-semibold text-ink-muted">—</span>
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
                  <StatusBadge tone={bookingStatusBadge(row).tone}>
                    {bookingStatusBadge(row).label}
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
      ) : tab === "serie" && series && event.seriesId ? (
        <SeriesPanel
          seriesId={event.seriesId}
          eventId={event.id}
          offer={series.offer}
          rates={event.modules.pricing?.rates ?? []}
          enrollments={series.enrollments}
          targets={series.targets}
          timeZone={timeZone}
        />
      ) : tab === "materiel" ? (
        <EventItems
          eventId={event.id}
          reserved={items}
          editable={event.status !== "cancelled" && event.endsAt > now}
          candidates={candidates}
        />
      ) : (
        <div className="grid gap-10 px-4 py-8 lg:grid-cols-[minmax(0,1fr)_340px]">
          <div className="reveal-group flex flex-col gap-4">
            <Eyebrow>Description</Eyebrow>
            <p className="whitespace-pre-line text-base font-medium leading-7 text-ink">
              {event.description || (
                <span className="text-ink-muted">Pas encore de description.</span>
              )}
            </p>
            {event.rules.length > 0 && (
              <>
                <Eyebrow className="pt-4">Règles « si… alors… »</Eyebrow>
                <ul className="flex flex-col gap-2">
                  {event.rules.map((rule) => (
                    <li
                      key={rule.id}
                      className="flex items-start gap-3.5 rounded-[14px] bg-surface px-3.5 py-3"
                    >
                      <span className="w-[92px] shrink-0 pt-0.5 text-[11px] font-bold uppercase leading-[14px] tracking-[0.06em] text-ink-subtle">
                        {ruleMomentLabel(rule.trigger)}
                      </span>
                      <span className="text-sm leading-[19px] text-ink">
                        <strong className="font-semibold">{rule.name}</strong> ·{" "}
                        {ruleSentence(rule, event.fields, event.modules.pricing)}
                      </span>
                    </li>
                  ))}
                </ul>
                <p className="text-meta font-semibold leading-4 text-ink-muted">
                  Ce que les règles ont fait
                </p>
                {ruleRuns.length === 0 ? (
                  <p className="text-sm text-ink-muted">Aucune règle n'a encore agi.</p>
                ) : (
                  <ul className="flex flex-col gap-1.5">
                    {ruleRuns.map((run) => (
                      <li key={run.id} className="text-sm leading-5 text-ink">
                        <span className="text-ink-muted">
                          {formatShortDateTime(run.createdAt, timeZone)} ·{" "}
                        </span>
                        {ruleJournalLine(run.ruleName, run.actions)}
                        {run.bookingId && (
                          <>
                            {" · "}
                            <Link
                              href={`/app/reservations/${run.bookingId}`}
                              className={textLinkClasses}
                            >
                              {run.customerName ?? run.bookingReference}
                            </Link>
                          </>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </>
            )}
          </div>
          <dl className="flex flex-col overflow-hidden rounded-3xl bg-surface">
            {[
              ["Type", event.typeName],
              ["Quand", formatEventRange(event.startsAt, event.endsAt, timeZone)],
              [
                "Lieu",
                [event.locationName, event.locationAddress].filter(Boolean).join(", ") || "—",
              ],
              ["Lien de visio", event.onlineUrl ?? "—"],
              ...(event.modules.staff ? [["Intervenant", event.staffName ?? "—"]] : []),
              ["Visibilité", event.visibility === "public" ? "Public" : "Sur invitation"],
              ["Réservation", event.requiresApproval ? "Validation manuelle" : "Automatique"],
              [
                "Paiement",
                event.paymentMode === "free"
                  ? "Gratuit"
                  : `${PAYMENT_MODE_LABELS[event.paymentMode]} · ${formatMoney(event.priceCents)} / pers.${event.paymentMode === "deposit" && event.modules.deposit ? ` · acompte ${depositLabel(event.modules.deposit)}` : ""}${event.modules.pricing && event.modules.pricing.rates.length > 1 ? ` · ${event.modules.pricing.rates.length} tarifs` : ""}`,
              ],
              // « Ce que tu décris », champs internes compris.
              ...answerRows(fieldsOfScope(event.fields, "event"), event.fieldValues, timeZone).map(
                (row) => [
                  row.label,
                  `${row.value}${event.fields.some((field) => field.key === row.key && field.visibility === "internal") ? " · interne" : ""}`,
                ],
              ),
            ].map(([label, value]) => (
              <div
                key={label}
                className="flex flex-col gap-1 border-b border-line-soft px-5 py-3.5 last:border-b-0"
              >
                <dt className="text-xs font-semibold leading-4 text-ink-muted">{label}</dt>
                <dd className="break-words text-ui font-semibold text-ink">{value}</dd>
              </div>
            ))}
          </dl>
        </div>
      )}
    </>
  );
}

/**
 * Couverture de l'événement (pages publiques) : ajout, remplacement, retrait au survol, ou
 * toujours visibles sur écran tactile. Pleine largeur sous xl, première case de la rangée à xl.
 */
function EventCover({ id, cover, color }: { id: string; cover: string | null; color: string }) {
  const { pick, remove, pending, error, fileInput } = useImageUpload("evenement", id);
  const action =
    "tap-area rounded-full bg-black/40 px-3 py-1 text-xs font-semibold text-white hover:bg-black/60 disabled:cursor-wait";
  return (
    <div
      className="group col-span-2 flex min-h-32 flex-col items-center justify-center gap-2 rounded-3xl bg-cover bg-center xl:col-span-1"
      style={cover ? { backgroundImage: `url(${cover})` } : meshCover(color, id)}
    >
      <div
        className={cn(
          "flex gap-1.5 transition-opacity",
          cover &&
            !pending &&
            "opacity-0 group-hover:opacity-100 focus-within:opacity-100 [@media(hover:none)]:opacity-100",
        )}
      >
        <button type="button" onClick={pick} disabled={pending} className={action}>
          {pending ? "Envoi…" : cover ? "Changer la photo" : "Ajouter une photo"}
        </button>
        {cover && !pending && (
          <button type="button" onClick={remove} className={action}>
            Retirer
          </button>
        )}
      </div>
      {error && (
        <p className="rounded-full bg-black/60 px-3 py-1 text-xs font-semibold text-white">
          {error}
        </p>
      )}
      {fileInput}
    </div>
  );
}
