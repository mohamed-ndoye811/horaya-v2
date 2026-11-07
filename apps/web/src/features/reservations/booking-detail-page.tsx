import { can, paidCents, rentalDays } from "@horaya/core";
import type { ReactNode } from "react";
import {
  BookingHeaderActions,
  ManualRefundButton,
  MarkPaidButton,
  RefundButton,
} from "@/components/app/booking-actions";
import { ItemTile } from "@/components/app/item-tile";
import { PageHeader } from "@/components/app/page-header";
import { Avatar } from "@/components/ui/avatar";
import { StatusBadge } from "@/components/ui/badge";
import { EventThumb } from "@/components/ui/cells";
import { cardClasses } from "@/components/ui/section";
import { BOOKING_STATUS_BADGE } from "@/components/ui/status";
import { Timeline } from "@/components/ui/timeline";
import type { getBooking } from "@/functions/booking";
import { describeBookingActivity } from "@/lib/activity";
import { cn } from "@/lib/cn";
import { elapsed } from "@/lib/dashboard";
import {
  compactUnitLabels,
  formatEventRange,
  formatMoney,
  formatRelativeDateTime,
  PAYMENT_MODE_LABELS,
} from "@/lib/format";
import { Link } from "@/lib/navigation";

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
      : booking.paymentMode === "on_site"
        ? "Payé"
        : "Payé en ligne";
  }
  return booking.paymentMode === "on_site"
    ? "À régler sur place"
    : "En attente du paiement en ligne";
}

const card = cardClasses;

function CardTitle({ children, count }: { children: ReactNode; count?: number }) {
  return (
    <h2 className="flex items-baseline gap-2 text-base font-semibold leading-5 text-ink">
      {children}
      {count !== undefined && (
        <span className="text-[13px] font-normal leading-[17px] text-ink-subtle">{count}</span>
      )}
    </h2>
  );
}

/** Chiffre clé sur fond gris (« Places 2 »), ambre quand il reste quelque chose à faire. */
function Tile({
  label,
  value,
  caption,
  tone,
}: {
  label: string;
  value: ReactNode;
  caption: ReactNode;
  tone?: "warning" | "success";
}) {
  return (
    <div
      className={cn(
        "flex min-w-0 flex-1 basis-0 flex-col gap-1 rounded-2xl px-4 py-3.5",
        tone === "warning" ? "bg-warning-bg" : "bg-field",
      )}
    >
      <dt
        className={cn(
          "text-xs font-semibold leading-4",
          tone === "warning" ? "text-[#8a6a2a]" : "text-ink-subtle",
        )}
      >
        {label}
      </dt>
      <dd className="font-headline text-[28px] leading-8 tracking-[-0.03em] text-ink">{value}</dd>
      <dd
        className={cn(
          "text-xs leading-4",
          tone === "warning"
            ? "font-semibold text-warning"
            : tone === "success"
              ? "font-semibold text-success"
              : "text-ink-subtle",
        )}
      >
        {caption}
      </dd>
    </div>
  );
}

/** « Hier, 21:12 » → « hier à 21:12 ». */
const inSentence = (relative: string) =>
  relative.replace(", ", " à ").replace(/^(Aujourd'hui|Hier)/, (word) => word.toLowerCase());

/** Maquette 1.5 : fiche d'une réservation. */
export function BookingDetailPage({ data }: { data: Awaited<ReturnType<typeof getBooking>> }) {
  const { timeZone, detail, payments, actor, integratedPaymentsEnabled } = data;

  const {
    booking,
    participants,
    activity,
    customerStats,
    eventSeatsHeld,
    rentalItems,
    assignedItems,
  } = detail;
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
  const isPending = booking.status === "pending";
  const waiting = elapsed(booking.createdAt, now);
  const received = inSentence(formatRelativeDateTime(booking.createdAt, timeZone, now));
  const subtitle = isPending ? (
    <>
      Demande reçue {received}.{" "}
      <span className="font-semibold text-[#9a6b12]">Sans réponse depuis {waiting}.</span>
    </>
  ) : booking.status === "refused" && booking.refusalReason ? (
    `Demande refusée · ${booking.refusalReason}`
  ) : (
    `Réservation ${booking.reference} · reçue ${received}`
  );
  const remaining = booking.event?.capacity
    ? Math.max(0, booking.event.capacity - eventSeatsHeld)
    : null;
  const paysOnline = booking.paymentMode === "online" || booking.paymentMode === "deposit";
  const paymentTone =
    booking.paymentMode === "free" || booking.paymentStatus === "refunded"
      ? undefined
      : booking.paymentStatus === "paid"
        ? ("success" as const)
        : ("warning" as const);
  const amountCaption = booking.depositCents
    ? `Acompte ${formatMoney(booking.depositCents)}`
    : booking.seats > 1 && booking.amountCents > 0
      ? `${booking.seats} × ${formatMoney(Math.round(booking.amountCents / booking.seats))} · TTC`
      : "TTC";

  const timeline = [
    ...(isPending
      ? [
          {
            id: "attente",
            title: "En attente de ta réponse",
            meta: `Depuis ${waiting}`,
            tone: "warning" as const,
          },
        ]
      : []),
    ...activity.map((entry) => {
      const described = describeBookingActivity(entry, booking.source);
      return {
        id: entry.id,
        title: described.title,
        tone: described.tone,
        meta: formatRelativeDateTime(entry.createdAt, timeZone, now),
      };
    }),
  ];

  return (
    <div className="flex flex-col pb-4">
      <PageHeader
        eyebrow={`Réservations / ${booking.reference}`}
        title={name}
        titleAside={<StatusBadge tone={badge.tone}>{badge.label}</StatusBadge>}
        subtitle={subtitle}
        actions={
          !isPending && (
            <BookingHeaderActions
              bookingId={booking.id}
              customerName={name}
              status={booking.status}
            />
          )
        }
      />
      <div className="flex flex-col gap-4 px-4 lg:flex-row lg:items-start">
        <div className="flex min-w-0 flex-1 flex-col gap-4">
          {isPending && (
            <section className="flex animate-drop flex-wrap items-center gap-x-4 gap-y-3 rounded-3xl bg-warning-bg py-3.5 pr-3.5 pl-5">
              <span
                aria-hidden="true"
                className="flex size-10 shrink-0 items-center justify-center rounded-full bg-surface"
              >
                <svg
                  aria-hidden="true"
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="#9a6b12"
                >
                  <circle cx="12" cy="12" r="9" strokeWidth="2" />
                  <path d="M12 7v5l3 2" strokeWidth="2" strokeLinecap="round" />
                </svg>
              </span>
              <div className="flex min-w-0 flex-1 basis-60 flex-col gap-0.5">
                <h2 className="text-[15px] font-bold leading-[19px] text-[#3a2e10]">
                  {booking.customer.firstName} attend ta réponse depuis {waiting}
                </h2>
                <p className="text-[13px] leading-[17px] text-[#8a6a2a]">
                  {paysOnline && booking.amountCents > 0
                    ? `Le lien de paiement en ligne (${formatMoney(booking.amountCents)}) part dès que tu valides.`
                    : "Un e-mail de confirmation part dès que tu valides."}
                </p>
              </div>
              <div className="flex w-full gap-2 *:flex-1 sm:w-auto sm:*:flex-none">
                <BookingHeaderActions
                  bookingId={booking.id}
                  customerName={name}
                  status={booking.status}
                  decision
                />
              </div>
            </section>
          )}

          {booking.event?.id && (
            <section className={cn(card, "gap-[18px]")}>
              <div className="flex flex-wrap items-center gap-x-3.5 gap-y-2">
                <div className="flex min-w-0 flex-1 basis-72 items-center gap-3.5">
                  <EventThumb
                    imageUrl={booking.event.coverImageUrl}
                    color={booking.typeColor ?? "#8a8a8a"}
                    size="lg"
                  />
                  <div className="flex min-w-0 flex-col gap-[3px]">
                    <div className="flex items-center gap-2">
                      {booking.typeColor && (
                        <span
                          aria-hidden="true"
                          className="size-2 shrink-0 rounded-full"
                          style={{ backgroundColor: booking.typeColor }}
                        />
                      )}
                      <span className="truncate text-lg font-semibold leading-[22px] text-ink">
                        {booking.event.title}
                      </span>
                    </div>
                    <p className="text-[13px] leading-[17px] text-ink-subtle">
                      {formatEventRange(booking.event.startsAt, booking.event.endsAt, timeZone)}
                      {booking.event.locationName ? ` · ${booking.event.locationName}` : ""}
                    </p>
                  </div>
                </div>
                <Link
                  href={`/app/evenements/${booking.event.id}`}
                  className="text-sm font-semibold leading-[18px] text-ink hover:underline"
                >
                  Voir l'événement →
                </Link>
              </div>
              <dl className="flex flex-col gap-3 sm:flex-row">
                <Tile
                  label="Places"
                  value={booking.seats}
                  caption={
                    remaining === null
                      ? "Places illimitées"
                      : `Reste ${remaining} place${remaining > 1 ? "s" : ""} sur ${booking.event.capacity}`
                  }
                />
                <Tile
                  label="Montant"
                  value={formatMoney(booking.amountCents)}
                  caption={amountCaption}
                />
                <Tile
                  label="Paiement"
                  value={PAYMENT_MODE_LABELS[booking.paymentMode]}
                  caption={paymentSummary(booking, paid)}
                  tone={paymentTone}
                />
              </dl>
              {assignedItems.length > 0 && (
                <ul className="flex flex-col">
                  {assignedItems.map((entry) => (
                    <li
                      key={entry.itemId}
                      className="flex items-center gap-3.5 border-t border-[#f4f4f2] py-3"
                    >
                      <ItemTile
                        name={entry.name}
                        reference={entry.reference}
                        photoUrl={entry.photoUrl}
                      />
                      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                        <Link
                          href={`/app/materiel/${entry.itemId}`}
                          className="truncate text-sm font-semibold text-ink hover:underline"
                        >
                          {entry.name}
                        </Link>
                        <span className="text-xs text-ink-subtle">
                          Attribué · ex. {compactUnitLabels(entry.units)}
                        </span>
                      </div>
                      <span className="text-sm font-semibold text-ink">× {entry.quantity}</span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          )}

          {booking.kind === "rental" && booking.rentalStartsAt && booking.rentalEndsAt && (
            <section className={cn(card, "gap-[18px]")}>
              <div className="flex flex-col gap-[3px]">
                <h2 className="text-lg font-semibold leading-[22px] text-ink">
                  Location de matériel
                </h2>
                <p className="text-[13px] leading-[17px] text-ink-subtle">
                  {formatEventRange(booking.rentalStartsAt, booking.rentalEndsAt, timeZone)}
                </p>
              </div>
              <ul className="flex flex-col">
                {rentalItems.map((entry) => (
                  <li
                    key={entry.itemId}
                    className="flex items-center gap-3.5 border-t border-[#f4f4f2] py-3"
                  >
                    <ItemTile
                      name={entry.name}
                      reference={entry.reference}
                      photoUrl={entry.photoUrl}
                    />
                    <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                      <Link
                        href={`/app/materiel/${entry.itemId}`}
                        className="truncate text-sm font-semibold text-ink hover:underline"
                      >
                        {entry.name}
                      </Link>
                      <span className="text-xs text-ink-subtle">
                        Réf. {entry.reference} · ex. {compactUnitLabels(entry.units)}
                      </span>
                    </div>
                    <span className="text-sm font-semibold text-ink">× {entry.quantity}</span>
                  </li>
                ))}
              </ul>
              <dl className="flex flex-col gap-3 sm:flex-row">
                <Tile
                  label="Durée"
                  value={`${rentalDays(booking.rentalStartsAt, booking.rentalEndsAt)} j`}
                  caption="Toute journée entamée est due"
                />
                <Tile
                  label="Montant"
                  value={formatMoney(booking.amountCents)}
                  caption={(() => {
                    const deposit = rentalItems.reduce(
                      (total, entry) => total + (entry.depositCents ?? 0) * entry.quantity,
                      0,
                    );
                    return deposit > 0 ? `Caution ${formatMoney(deposit)}` : "TTC";
                  })()}
                />
                <Tile
                  label="Paiement"
                  value={PAYMENT_MODE_LABELS[booking.paymentMode]}
                  caption={booking.paymentMode === "free" ? "Rien à régler" : "À régler au retrait"}
                  tone={booking.paymentMode === "free" ? undefined : "warning"}
                />
              </dl>
            </section>
          )}

          {booking.customerMessage && (
            <section className={cn(card, "gap-2.5")}>
              <CardTitle>Message du client</CardTitle>
              <blockquote className="rounded-2xl border-l-[3px] border-[#dcdcd8] bg-field px-4 py-3.5 text-[15px] leading-[22px] text-[#333]">
                « {booking.customerMessage} »
              </blockquote>
            </section>
          )}

          {participants.length > 0 && (
            <section className={cn(card, "gap-1.5")}>
              <div className="pb-1.5">
                <CardTitle count={participants.length}>Participants</CardTitle>
              </div>
              <ul className="flex flex-col">
                {participants.map((participant) => {
                  const answers = Object.entries(participant.customAnswers ?? {});
                  const fullName = `${participant.firstName} ${participant.lastName}`;
                  return (
                    <li
                      key={participant.id}
                      className="flex min-h-12 flex-wrap items-center gap-x-3 gap-y-1 border-t border-[#f4f4f2] py-2"
                    >
                      <Avatar name={fullName} size="xs" />
                      <span className="min-w-0 flex-1 text-sm font-semibold leading-[18px] text-ink">
                        {fullName}
                        <span className="font-normal text-ink-subtle">
                          {" "}
                          · {participant.email ?? "pas d'e-mail"}
                        </span>
                      </span>
                      {answers.length > 0 && (
                        <span className="text-[13px] leading-[17px] text-ink-subtle">
                          {answers
                            .map(
                              ([key, value]) =>
                                `${key.replaceAll("_", " ")} : ${value === true ? "oui" : value === false ? "non" : value}`,
                            )
                            .join(" · ")}
                        </span>
                      )}
                    </li>
                  );
                })}
              </ul>
            </section>
          )}

          {(payments.length > 0 || canMarkPaid) && (
            <section className={cn(card, "gap-3")}>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <CardTitle>Paiements</CardTitle>
                <div className="flex flex-wrap gap-2">
                  {canRefund &&
                    (refundsOnline ? (
                      <RefundButton bookingId={booking.id} maxCents={paid} />
                    ) : (
                      <ManualRefundButton bookingId={booking.id} maxCents={paid} />
                    ))}
                  {canMarkPaid && (
                    <MarkPaidButton bookingId={booking.id} defaultCents={markPaidDefault} />
                  )}
                </div>
              </div>
              {booking.status === "cancelled" && paid > 0 && !refundsOnline && (
                <p className="rounded-2xl bg-warning-bg px-4 py-3 text-sm font-semibold text-warning">
                  Ce client avait payé {formatMoney(paid)} hors Horaya : rembourse-le selon ta
                  politique d'annulation, puis note le remboursement.
                </p>
              )}
              {payments.length === 0 ? (
                <p className="rounded-2xl border-[1.5px] border-dashed border-[#e2e2df] p-4 text-center text-sm leading-5 text-ink-subtle">
                  {isPending && paysOnline
                    ? "Rien d'encaissé pour l'instant. Le lien de paiement part dès que tu valides la réservation."
                    : "Rien d'encaissé pour l'instant. Quand le paiement arrive, note-le avec « Marquer comme payé »."}
                </p>
              ) : (
                <ul className="flex flex-col">
                  {payments.map((entry) => (
                    <li
                      key={entry.id}
                      className="flex items-center justify-between gap-4 border-t border-[#f4f4f2] py-3"
                    >
                      <span className="flex flex-col gap-0.5">
                        <span className="text-sm font-semibold text-ink">
                          {PAYMENT_KIND_LABELS[entry.kind]}
                        </span>
                        <span className="text-xs text-ink-subtle">
                          {formatRelativeDateTime(entry.createdAt, timeZone, now)} ·{" "}
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
                        <span className="w-24 text-right text-sm font-semibold text-ink">
                          {entry.kind === "refund" ? "−" : ""}
                          {formatMoney(entry.amountCents)}
                        </span>
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          )}
        </div>

        <aside className="flex flex-col gap-4 lg:w-[400px] lg:shrink-0">
          <section className={cn(card, "gap-4")}>
            <div className="flex items-center gap-3.5">
              <Avatar name={name} size="profile" />
              <div className="flex min-w-0 flex-col gap-0.5">
                <span className="truncate text-[17px] font-semibold leading-[22px] text-ink">
                  {name}
                </span>
                <span className="truncate text-[13px] leading-[17px] text-ink-subtle">
                  {[booking.customer.email, booking.customer.phone].filter(Boolean).join(" · ")}
                </span>
              </div>
            </div>
            <dl className="flex gap-2">
              {[
                [customerStats.bookings, `réservation${customerStats.bookings > 1 ? "s" : ""}`],
                [formatMoney(customerStats.spentCents), "dépensés"],
                [
                  customerStats.cancellations,
                  `annulation${customerStats.cancellations > 1 ? "s" : ""}`,
                ],
              ].map(([value, label]) => (
                <div
                  key={String(label)}
                  className="flex min-w-0 flex-1 basis-0 flex-col gap-0.5 rounded-[14px] bg-field p-3"
                >
                  <dt className="order-2 text-xs leading-4 text-ink-subtle">{label}</dt>
                  <dd className="font-headline text-[22px] leading-[26px] tracking-[-0.02em] text-ink">
                    {value}
                  </dd>
                </div>
              ))}
            </dl>
            <Link
              href={`/app/clients/${booking.customer.id}`}
              className="w-fit text-sm font-semibold leading-[18px] text-ink hover:underline"
            >
              Voir la fiche client →
            </Link>
          </section>
          <section className={cn(card, "gap-3.5")}>
            <CardTitle>Historique</CardTitle>
            <Timeline items={timeline} />
          </section>
          <p className="px-2 text-xs leading-[17px] text-ink-subtle">
            {integratedPaymentsEnabled
              ? "Une réservation payée en ligne et annulée est remboursée automatiquement sur la carte du client (selon ta politique d'annulation s'il annule lui-même). Un règlement sur place se rembourse hors d'Horaya."
              : "Les paiements passent par tes liens de paiement : note-les ici dès que tu les reçois pour garder des chiffres justes."}
          </p>
        </aside>
      </div>
    </div>
  );
}
