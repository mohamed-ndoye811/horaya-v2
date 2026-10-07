import { getBookingDetail } from "@horaya/db";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { BookingHeaderActions } from "@/components/app/booking-actions";
import { PageHeader } from "@/components/app/page-header";
import { Avatar, CategorySwatch } from "@/components/ui/avatar";
import { StatusBadge } from "@/components/ui/badge";
import { textLinkClasses } from "@/components/ui/button";
import { Eyebrow } from "@/components/ui/section";
import { BOOKING_STATUS_BADGE } from "@/components/ui/status";
import { Timeline } from "@/components/ui/timeline";
import { describeBookingActivity } from "@/lib/activity";
import {
  formatEventRange,
  formatMoney,
  formatShortDateTime,
  PAYMENT_MODE_LABELS,
} from "@/lib/format";
import { db } from "@/server/db";
import { getWorkspaceContext } from "@/server/workspace";

export const metadata: Metadata = { title: "Réservation · Horaya" };

function since(date: Date, now: Date): string {
  const days = Math.floor((now.getTime() - date.getTime()) / 86_400_000);
  if (days <= 0) return "aujourd'hui";
  return days === 1 ? "1 jour" : `${days} jours`;
}

/** Écran 17 : fiche d'une réservation. */
export default async function BookingDetailPage({ params }: PageProps<"/app/reservations/[id]">) {
  const { id } = await params;
  const { workspace, timeZone } = await getWorkspaceContext();
  const detail = await getBookingDetail(db, workspace.id, id);
  if (!detail) notFound();

  const { booking, participants, activity, customerStats, eventSeatsHeld } = detail;
  const name = `${booking.customer.firstName} ${booking.customer.lastName}`;
  const badge = BOOKING_STATUS_BADGE[booking.status];
  const now = new Date();
  const received = `${new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "long", timeZone }).format(booking.createdAt)} à ${new Intl.DateTimeFormat("fr-FR", { hour: "2-digit", minute: "2-digit", hourCycle: "h23", timeZone }).format(booking.createdAt)}`;
  const subtitle =
    booking.status === "pending"
      ? `Demande reçue le ${received} · sans réponse depuis ${since(booking.createdAt, now)}`
      : booking.status === "refused" && booking.refusalReason
        ? `Demande refusée · ${booking.refusalReason}`
        : `Réservation ${booking.reference} · reçue le ${received}`;
  const remaining = booking.event?.capacity
    ? Math.max(0, booking.event.capacity - eventSeatsHeld)
    : null;

  return (
    <div className="flex min-h-dvh flex-col">
      <PageHeader
        eyebrow={`Réservations / ${booking.reference}`}
        title={name}
        titleAside={<StatusBadge tone={badge.tone}>{badge.label}</StatusBadge>}
        subtitle={subtitle}
        actions={
          <BookingHeaderActions
            bookingId={booking.id}
            customerName={name}
            status={booking.status}
          />
        }
      />
      <div className="flex flex-1 flex-col lg:flex-row">
        <div className="flex min-w-0 flex-1 flex-col gap-8 px-4 py-8 sm:px-10">
          {booking.event?.id && (
            <section className="border-2 border-ink bg-surface">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-line-soft px-5 py-4">
                {booking.typeColor && <CategorySwatch color={booking.typeColor} size={12} />}
                <Link
                  href={`/app/evenements/${booking.event.id}`}
                  className="text-lg font-extrabold text-ink hover:underline"
                >
                  {booking.event.title}
                </Link>
                <span className="text-sm font-medium text-ink-muted">
                  · {formatEventRange(booking.event.startsAt, booking.event.endsAt, timeZone)}
                  {booking.event.locationName ? ` · ${booking.event.locationName}` : ""}
                </span>
              </div>
              <dl className="grid sm:grid-cols-3">
                <div className="flex flex-col gap-1.5 border-line-soft px-5 py-4 sm:border-r">
                  <dt className="font-mono text-label font-semibold uppercase tracking-[0.055em] text-neutral">
                    Places
                  </dt>
                  <dd className="text-2xl font-extrabold text-ink">{booking.seats}</dd>
                  <dd className="text-[13px] font-medium text-ink-muted">
                    {remaining === null
                      ? "Places illimitées"
                      : `Reste ${remaining} place${remaining > 1 ? "s" : ""} sur ${booking.event.capacity}`}
                  </dd>
                </div>
                <div className="flex flex-col gap-1.5 border-line-soft px-5 py-4 sm:border-r">
                  <dt className="font-mono text-label font-semibold uppercase tracking-[0.055em] text-neutral">
                    Montant
                  </dt>
                  <dd className="text-2xl font-extrabold text-ink">
                    {formatMoney(booking.amountCents)}
                  </dd>
                  <dd className="text-[13px] font-medium text-ink-muted">
                    {booking.depositCents ? `Acompte ${formatMoney(booking.depositCents)}` : "TTC"}
                  </dd>
                </div>
                <div className="flex flex-col gap-1.5 px-5 py-4">
                  <dt className="font-mono text-label font-semibold uppercase tracking-[0.055em] text-neutral">
                    Paiement
                  </dt>
                  <dd className="text-lg font-extrabold text-ink">
                    {PAYMENT_MODE_LABELS[booking.paymentMode]}
                  </dd>
                  <dd className="text-[13px] font-medium text-warning">
                    {booking.paymentMode === "free"
                      ? "Rien à régler"
                      : booking.paymentMode === "on_site"
                        ? "À régler sur place"
                        : "Paiement en ligne bientôt disponible"}
                  </dd>
                </div>
              </dl>
            </section>
          )}

          {booking.customerMessage && (
            <section className="flex flex-col gap-3">
              <Eyebrow>Message du client</Eyebrow>
              <blockquote className="border-l-4 border-ink bg-surface px-6 py-4 text-base font-medium leading-7 text-ink">
                « {booking.customerMessage} »
              </blockquote>
            </section>
          )}

          {participants.length > 0 && (
            <section className="flex flex-col gap-3">
              <Eyebrow>Participants</Eyebrow>
              <ul className="flex flex-col border-[1.5px] border-line-soft bg-surface">
                {participants.map((participant) => (
                  <li
                    key={participant.id}
                    className="flex flex-col gap-1 border-b border-line-soft px-5 py-3 last:border-b-0"
                  >
                    <span className="font-bold text-ink">
                      {participant.firstName} {participant.lastName}
                      {participant.email ? (
                        <span className="font-medium text-ink-muted"> · {participant.email}</span>
                      ) : null}
                    </span>
                    {Object.entries(participant.customAnswers ?? {}).length > 0 && (
                      <span className="text-sm font-medium text-ink-muted">
                        {Object.entries(participant.customAnswers)
                          .map(
                            ([key, value]) =>
                              `${key.replaceAll("_", " ")} : ${value === true ? "oui" : value === false ? "non" : value}`,
                          )
                          .join(" · ")}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>

        <aside className="flex flex-col border-t-2 border-ink bg-surface lg:w-[400px] lg:shrink-0 lg:border-t-0 lg:border-l-2">
          <section className="flex flex-col gap-4 border-b border-line-soft px-7 py-6">
            <Eyebrow>Client</Eyebrow>
            <div className="flex items-center gap-3.5">
              <Avatar name={name} size="lg" />
              <div className="flex min-w-0 flex-col gap-0.5">
                <span className="truncate text-base font-bold text-ink">{name}</span>
                <span className="truncate text-sm font-medium text-ink-muted">
                  {[booking.customer.email, booking.customer.phone].filter(Boolean).join(" · ")}
                </span>
              </div>
            </div>
            <dl className="flex gap-6">
              {[
                [customerStats.bookings, `réservation${customerStats.bookings > 1 ? "s" : ""}`],
                [formatMoney(customerStats.spentCents), "dépensés"],
                [
                  customerStats.cancellations,
                  `annulation${customerStats.cancellations > 1 ? "s" : ""}`,
                ],
              ].map(([value, label]) => (
                <div key={String(label)} className="flex flex-col">
                  <dt className="order-2 text-[13px] font-medium text-ink-muted">{label}</dt>
                  <dd className="text-lg font-extrabold text-ink">{value}</dd>
                </div>
              ))}
            </dl>
            <Link
              href={`/app/clients/${booking.customer.id}`}
              className={`${textLinkClasses} text-sm`}
            >
              Voir la fiche client
            </Link>
          </section>
          <section className="flex flex-col gap-4 border-b border-line-soft px-7 py-6">
            <Eyebrow>Historique</Eyebrow>
            <Timeline
              items={activity.map((entry) => {
                const described = describeBookingActivity(entry, booking.source);
                return {
                  id: entry.id,
                  title: described.title,
                  tone: described.tone,
                  meta: formatShortDateTime(entry.createdAt, timeZone),
                };
              })}
            />
          </section>
          <section className="mt-auto flex flex-col gap-3 px-7 py-6">
            <p className="text-[13px] font-medium leading-5 text-ink-muted">
              Remboursements : ils arriveront avec les paiements en ligne. Pour l'instant, un
              règlement sur place se rembourse hors d'Horaya.
            </p>
          </section>
        </aside>
      </div>
    </div>
  );
}
