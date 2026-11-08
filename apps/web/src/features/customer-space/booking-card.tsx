import { useState } from "react";
import { StatusBadge } from "@/components/ui/badge";
import { Button, ButtonLink } from "@/components/ui/button";
import { ChevronRight } from "@/components/ui/icons";
import { reportCustomerAbsenceAction } from "@/functions/customer-space";
import { bookingBadge, cardDate } from "@/lib/customer-space";
import { formatDayNumber, formatTimeRange, formatWeekdayShort } from "@/lib/format";
import { Link } from "@/lib/navigation";
import type { CustomerBookingCard, CustomerSessionCard } from "@/server/customer-space";
import { AbsenceButton } from "../enrollments/enrollment-progress";
import { PayAction } from "./actions";

export const bookingHref = (card: Pick<CustomerSessionCard, "slug" | "id">) =>
  `/${card.slug}/mon-espace/${card.id}`;

/** « 10h – 17h · 1 place » (sous le titre d'une carte). */
export function bookingDetails(card: CustomerSessionCard): string {
  const places = `${card.seats} place${card.seats > 1 ? "s" : ""}`;
  return card.startsAt && card.endsAt
    ? `${formatTimeRange(card.startsAt, card.endsAt, card.timezone)} · ${places}`
    : places;
}

/**
 * Carte d'une réservation à venir (maquettes 8.2 et 8.5) : de vrais boutons, aucune action en
 * lien texte. Payer s'il reste à payer, puis changer de date ou gérer.
 */
export function BookingCard({ card }: { card: CustomerBookingCard }) {
  const badge = bookingBadge(card);
  const href = bookingHref(card);
  const move = card.reschedulable && !card.pay;
  const [open, setOpen] = useState(false);
  const { series } = card;
  return (
    <article className="flex min-w-0 flex-col gap-3.5 rounded-[20px] border border-line p-5">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[13px] font-bold leading-4 text-[var(--brand-text)]">
          {card.startsAt && card.endsAt ? cardDate(card.startsAt, card.endsAt, card.timezone) : ""}
        </p>
        <StatusBadge tone={badge.tone}>{badge.label}</StatusBadge>
      </div>
      <div className="flex flex-col gap-1">
        <h3 className="text-lg font-semibold leading-6 text-ink">{card.title}</h3>
        <p className="text-sm leading-5 text-ink-muted">{bookingDetails(card)}</p>
        {series && (
          <p className="text-[13px] leading-4 text-ink-muted">
            Trimestre · séance {series.progress.current} sur {series.progress.total}
          </p>
        )}
      </div>
      <div className="flex flex-wrap gap-2 pt-0.5">
        {card.pay && <PayAction slug={card.slug} bookingId={card.id} pay={card.pay} />}
        <ButtonLink href={move ? `${href}#changer` : href} variant="soft" size="sm">
          {move ? "Changer de date" : "Gérer"}
        </ButtonLink>
        {series && card.eventId && card.startsAt && (
          <AbsenceButton
            session={{ eventId: card.eventId, title: card.title, startsAt: card.startsAt }}
            timeZone={card.timezone}
            onAbsent={() => reportCustomerAbsenceAction(card.slug, card.id)}
          />
        )}
        {series && (
          <Button variant="inverse" size="sm" aria-expanded={open} onClick={() => setOpen(!open)}>
            {open ? "Masquer les séances" : "Voir les séances"}
          </Button>
        )}
      </div>
      {series && open && (
        <div className="flex flex-col rounded-2xl bg-bg px-4 py-1">
          {series.sessions.map((session) => (
            <BookingRow key={session.id} card={session} />
          ))}
        </div>
      )}
    </article>
  );
}

/** Ligne compacte d'une réservation sur mobile (maquette 8.6) : toute la ligne est un lien. */
export function BookingRow({ card }: { card: CustomerSessionCard }) {
  const badge = bookingBadge(card);
  return (
    <Link
      href={bookingHref(card)}
      className="flex items-center gap-3.5 border-b border-line py-3.5 last:border-b-0"
    >
      <span className="flex w-12 shrink-0 flex-col items-center rounded-xl bg-bg py-1.5">
        <span className="text-[10px] font-bold uppercase leading-3 tracking-[0.06em] text-[var(--brand-text)]">
          {card.startsAt ? formatWeekdayShort(card.startsAt, card.timezone) : ""}
        </span>
        <span className="text-[19px] font-semibold leading-[22px] text-ink">
          {card.startsAt ? formatDayNumber(card.startsAt, card.timezone) : ""}
        </span>
      </span>
      <span className="flex min-w-0 flex-1 flex-col gap-1">
        <span className="truncate text-[15px] font-semibold leading-5 text-ink">{card.title}</span>
        <span className="flex min-w-0 items-center gap-1.5">
          <span className="truncate text-[13px] leading-[18px] text-ink-muted">
            {bookingDetails(card)}
          </span>
          <StatusBadge tone={badge.tone} size="sm">
            {badge.label}
          </StatusBadge>
        </span>
      </span>
      <ChevronRight className="shrink-0 text-ink-subtle" />
    </Link>
  );
}
