import { can, paidCents, rentalDays } from "@horaya/core";
import { getBookingDetail, listBookingPayments } from "@horaya/db";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  BookingHeaderActions,
  ManualRefundButton,
  MarkPaidButton,
  RefundButton,
} from "@/components/app/booking-actions";
import { ItemTile } from "@/components/app/item-tile";
import { PageHeader } from "@/components/app/page-header";
import { Avatar, CategorySwatch } from "@/components/ui/avatar";
import { StatusBadge } from "@/components/ui/badge";
import { textLinkClasses } from "@/components/ui/button";
import { Eyebrow } from "@/components/ui/section";
import { BOOKING_STATUS_BADGE } from "@/components/ui/status";
import { Timeline } from "@/components/ui/timeline";
import { describeBookingActivity } from "@/lib/activity";
import { cn } from "@/lib/cn";
import {
  compactUnitLabels,
  formatEventRange,
  formatMoney,
  formatShortDateTime,
  PAYMENT_MODE_LABELS,
} from "@/lib/format";
import { db } from "@/server/db";
import { integratedPaymentsEnabled } from "@/server/payments/config";
import { getWorkspaceContext } from "@/server/workspace";

export const metadata: Metadata = { title: "Réservation · Horaya" };

function since(date: Date, now: Date): string {
  const days = Math.floor((now.getTime() - date.getTime()) / 86_400_000);
  if (days <= 0) return "aujourd'hui";
  return days === 1 ? "1 jour" : `${days} jours`;
}

const PAYMENT_KIND_LABELS: Record<string, string> = {
  charge: "Paiement",
  deposit: "Acompte",
  balance: "Solde",
  refund: "Remboursement",
};
const PAYMENT_STATUS_LABELS: Record<string, string> = {
  pending: "En cours",
  succeeded: "Réussi",
  failed: "Abandonné",
};

function paymentSummary(
  booking: { paymentMode: string; paymentStatus: string; amountCents: number },
  paid: number,
): string {
  if (booking.paymentMode === "free") return "Rien à régler";
  if (booking.paymentStatus === "refunded") return "Remboursé";
  if (booking.paymentStatus === "partially_refunded")
    return `Remboursé en partie · ${formatMoney(paid)} gardés`;
  if (booking.paymentStatus === "paid") {
    return booking.paymentMode === "deposit"
      ? `Acompte payé · ${formatMoney(booking.amountCents - paid)} sur place`
      : "Payé en ligne";
  }
  return booking.paymentMode === "on_site"
    ? "À régler sur place"
    : "En attente du paiement en ligne";
}

/** Écran 17 : fiche d'une réservation. */
export default async function BookingDetailPage({ params }: PageProps<"/app/reservations/[id]">) {
  const { id } = await params;
  const { workspace, timeZone } = await getWorkspaceContext();
  const detail = await getBookingDetail(db, workspace.id, id);
  if (!detail) notFound();

  const { booking, participants, activity, customerStats, eventSeatsHeld, rentalItems } = detail;
  const { actor } = await getWorkspaceContext();
  const payments = await listBookingPayments(db, booking.id);
  const paid = paidCents(payments);
  const canRefund = actor.type === "member" && can(actor.role, "booking", "refund") && paid > 0;
  // Remboursement en ligne seulement si l'argent est passé par Stripe ; sinon on le note.
  const refundsOnline = payments.some(
    (entry) =>
      entry.kind !== "refund" && entry.status === "succeeded" && entry.provider !== "manual",
  );
  const active =
    booking.status === "pending" ||
    booking.status === "confirmed" ||
    booking.status === "waitlisted";
  const canMarkPaid =
    actor.type === "member" &&
    can(actor.role, "booking", "update") &&
    active &&
    booking.paymentMode !== "free" &&
    booking.amountCents > paid;
  const markPaidDefault =
    booking.paymentMode === "deposit" && paid === 0 && booking.depositCents
      ? booking.depositCents
      : booking.amountCents - paid;
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
                  <dd
                    className={cn(
                      "text-[13px] font-medium",
                      booking.paymentStatus === "paid" ? "text-success" : "text-warning",
                    )}
                  >
                    {paymentSummary(booking, paid)}
                  </dd>
                </div>
              </dl>
            </section>
          )}

          {booking.kind === "rental" && booking.rentalStartsAt && booking.rentalEndsAt && (
            <section className="border-2 border-ink bg-surface">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-line-soft px-5 py-4">
                <span className="text-lg font-extrabold text-ink">Location de matériel</span>
                <span className="text-sm font-medium text-ink-muted">
                  · {formatEventRange(booking.rentalStartsAt, booking.rentalEndsAt, timeZone)}
                </span>
              </div>
              <ul className="border-b border-line-soft">
                {rentalItems.map((entry) => (
                  <li key={entry.itemId} className="flex items-center gap-3.5 px-5 py-3">
                    <ItemTile name={entry.name} reference={entry.reference} />
                    <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                      <Link
                        href={`/app/materiel/${entry.itemId}`}
                        className="truncate text-base font-bold text-ink hover:underline"
                      >
                        {entry.name}
                      </Link>
                      <span className="font-mono text-label text-ink-muted">
                        Réf. {entry.reference} · ex. {compactUnitLabels(entry.units)}
                      </span>
                    </div>
                    <span className="font-mono text-sm font-semibold text-ink">
                      × {entry.quantity}
                    </span>
                  </li>
                ))}
              </ul>
              <dl className="grid sm:grid-cols-3">
                <div className="flex flex-col gap-1.5 border-line-soft px-5 py-4 sm:border-r">
                  <dt className="font-mono text-label font-semibold uppercase tracking-[0.055em] text-neutral">
                    Durée
                  </dt>
                  <dd className="text-2xl font-extrabold text-ink">
                    {rentalDays(booking.rentalStartsAt, booking.rentalEndsAt)} j
                  </dd>
                  <dd className="text-[13px] font-medium text-ink-muted">
                    Toute journée entamée est due
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
                    {(() => {
                      const deposit = rentalItems.reduce(
                        (total, entry) => total + (entry.depositCents ?? 0) * entry.quantity,
                        0,
                      );
                      return deposit > 0 ? `Caution ${formatMoney(deposit)}` : "TTC";
                    })()}
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
                    {booking.paymentMode === "free" ? "Rien à régler" : "À régler au retrait"}
                  </dd>
                </div>
              </dl>
            </section>
          )}

          {(payments.length > 0 || canMarkPaid) && (
            <section className="flex flex-col gap-3">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <Eyebrow>Paiements</Eyebrow>
                <div className="flex flex-wrap gap-2">
                  {canMarkPaid && (
                    <MarkPaidButton bookingId={booking.id} defaultCents={markPaidDefault} />
                  )}
                  {canRefund &&
                    (refundsOnline ? (
                      <RefundButton bookingId={booking.id} maxCents={paid} />
                    ) : (
                      <ManualRefundButton bookingId={booking.id} maxCents={paid} />
                    ))}
                </div>
              </div>
              {booking.status === "cancelled" && paid > 0 && !refundsOnline && (
                <p className="border-[1.5px] border-warning bg-warning-bg px-4 py-3 text-sm font-semibold text-warning">
                  Ce client avait payé {formatMoney(paid)} hors Horaya : rembourse-le selon ta
                  politique d'annulation, puis note le remboursement.
                </p>
              )}
              {payments.length === 0 && (
                <p className="text-sm font-medium text-ink-muted">
                  Rien d'encaissé pour l'instant. Quand le paiement arrive, note-le avec « Marquer
                  comme payé ».
                </p>
              )}
              <ul className="flex flex-col border-t border-line-soft">
                {payments.map((entry) => (
                  <li
                    key={entry.id}
                    className="flex items-center justify-between gap-4 border-b border-line-soft py-3"
                  >
                    <span className="flex flex-col gap-0.5">
                      <span className="text-[15px] font-bold text-ink">
                        {PAYMENT_KIND_LABELS[entry.kind]}
                      </span>
                      <span className="font-mono text-label text-ink-muted">
                        {formatShortDateTime(entry.createdAt, timeZone)} ·{" "}
                        {entry.provider === "manual"
                          ? "noté par l'équipe"
                          : entry.provider === "test"
                            ? "paiement de test"
                            : "Stripe"}
                      </span>
                    </span>
                    <span className="flex items-center gap-3">
                      <StatusBadge
                        tone={
                          entry.status === "succeeded"
                            ? "success"
                            : entry.status === "pending"
                              ? "warning"
                              : "draft"
                        }
                      >
                        {PAYMENT_STATUS_LABELS[entry.status]}
                      </StatusBadge>
                      <span className="w-24 text-right font-mono text-sm font-semibold text-ink">
                        {entry.kind === "refund" ? "−" : ""}
                        {formatMoney(entry.amountCents)}
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
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
              {integratedPaymentsEnabled
                ? "Une réservation payée en ligne et annulée est remboursée automatiquement sur la carte du client (selon ta politique d'annulation s'il annule lui-même). Un règlement sur place se rembourse hors d'Horaya."
                : "Les paiements passent par ton lien de paiement : note ici chaque paiement reçu et chaque remboursement fait, le client reçoit un e-mail à chaque fois."}
            </p>
          </section>
        </aside>
      </div>
    </div>
  );
}
