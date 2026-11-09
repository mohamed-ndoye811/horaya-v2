import { PageHeader } from "@/components/app/page-header";
import { CountUp } from "@/components/motion/count-up";
import { StatusBadge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { Eyebrow, inkCardClasses } from "@/components/ui/section";
import { Timeline } from "@/components/ui/timeline";
import type { getGiftCard } from "@/functions/gift-cards";
import { cn } from "@/lib/cn";
import { formatMoney, formatShortDateTime } from "@/lib/format";
import { formatGiftCardDate, GIFT_CARD_MOVEMENT, GIFT_CARD_STATE } from "@/lib/gift-card";
import { GiftCardActions } from "./gift-card-actions";

const Row = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div className="flex flex-col gap-0.5 border-t border-line-faint py-3 first:border-t-0">
    <dt className="text-xs font-bold leading-4 text-ink-muted">{label}</dt>
    <dd className="text-sm leading-5 text-ink">{children}</dd>
  </div>
);

/** Fiche d'un bon : solde, parties, journal des mouvements, actions. */
export function GiftCardDetailPage({ data }: { data: Awaited<ReturnType<typeof getGiftCard>> }) {
  const { card, movements, timeZone, slug } = data;
  const state = GIFT_CARD_STATE[card.state];
  return (
    <>
      <PageHeader
        eyebrow={`Bons cadeaux / ${card.code}`}
        title={card.code}
        titleAside={<StatusBadge tone={state.tone}>{state.label}</StatusBadge>}
        subtitle={`${card.purchaserName} offre ${formatMoney(card.initialCents)} à ${card.recipientName}`}
        actions={
          <>
            <ButtonLink href={`/${slug}/bon-cadeau/${card.viewToken}`} variant="secondary">
              Page imprimable
            </ButtonLink>
            <GiftCardActions id={card.id} state={card.state} />
          </>
        }
      />
      <div className="reveal-group grid items-start gap-4 px-4 pb-4 xl:grid-cols-[minmax(0,1fr)_340px]">
        <section className="flex flex-col gap-4 rounded-3xl bg-surface p-5 sm:p-6">
          <h2 className="text-lg font-semibold leading-[22px] text-ink">Journal</h2>
          {movements.length === 0 ? (
            <p className="text-sm leading-5 text-ink-subtle">
              Aucun mouvement : le bon n'est pas encore payé.
            </p>
          ) : (
            <Timeline
              items={[...movements].reverse().map((movement) => ({
                id: movement.id,
                title: `${GIFT_CARD_MOVEMENT[movement.kind].label} · ${movement.amountCents > 0 ? "+" : "−"}${formatMoney(Math.abs(movement.amountCents))}`,
                meta: [
                  formatShortDateTime(movement.createdAt, timeZone),
                  movement.bookingReference ? `réservation ${movement.bookingReference}` : null,
                  movement.note,
                ]
                  .filter(Boolean)
                  .join(" · "),
                tone: GIFT_CARD_MOVEMENT[movement.kind].tone,
              }))}
            />
          )}
        </section>
        <aside className="reveal-group flex flex-col gap-4">
          <div className={cn(inkCardClasses, "flex flex-col gap-1 rounded-3xl p-5")}>
            <Eyebrow variant="caps">Solde</Eyebrow>
            <p className="text-[40px] font-semibold leading-[44px] tracking-[-0.03em]">
              <CountUp value={formatMoney(card.balanceCents)} />
            </p>
            <p className="text-meta leading-[18px] text-on-ink-muted">
              sur {formatMoney(card.initialCents)}
              {card.expiresAt && ` · jusqu'au ${formatGiftCardDate(card.expiresAt, timeZone)}`}
            </p>
          </div>
          <dl className="flex flex-col rounded-3xl bg-surface px-5 py-2">
            <Row label="Acheteur">
              {card.purchaserName}
              <br />
              <span className="text-ink-muted">{card.purchaserEmail}</span>
            </Row>
            <Row label="Bénéficiaire">
              {card.recipientName}
              {card.recipientEmail && (
                <>
                  <br />
                  <span className="text-ink-muted">{card.recipientEmail}</span>
                </>
              )}
            </Row>
            {card.message && <Row label="Message">{card.message}</Row>}
            <Row label="Vente">
              {card.source === "counter" ? "Comptoir" : "Page publique"} · le{" "}
              {formatGiftCardDate(card.createdAt, timeZone)}
            </Row>
          </dl>
        </aside>
      </div>
    </>
  );
}
