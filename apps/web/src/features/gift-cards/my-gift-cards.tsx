import { CountUp } from "@/components/motion/count-up";
import { cardShellClasses } from "@/components/ui/section";
import { cn } from "@/lib/cn";
import { formatMoney } from "@/lib/format";
import { formatGiftCardDate } from "@/lib/gift-card";

export interface MyGiftCard {
  id: string;
  code: string;
  balanceCents: number;
  expiresAt: Date | null;
}

/**
 * Bloc « Mes bons cadeaux » de l'espace client (maquette 8.2). Autonome : le lot 29 le pose
 * dans l'accueil avec `giftCardsForCustomer` (server/gift-cards.ts). Rien ne s'affiche
 * s'il n'y a aucun bon utilisable.
 */
export function MyGiftCards({
  cards,
  timeZone,
  className,
}: {
  cards: MyGiftCard[];
  timeZone?: string;
  className?: string;
}) {
  if (cards.length === 0) return null;
  const total = cards.reduce((sum, card) => sum + card.balanceCents, 0);
  return (
    <section
      aria-label="Mes bons cadeaux"
      className={cn(cardShellClasses, "reveal-group gap-3 px-7 py-6", className)}
    >
      <h2 className="text-meta font-semibold leading-4 text-ink-muted">Mes bons cadeaux</h2>
      {cards.map((card) => (
        <div key={card.id} className="flex items-center justify-between gap-4">
          <div className="flex min-w-0 flex-col gap-0.5">
            <p className="text-xl font-semibold leading-[26px] text-ink">
              <CountUp value={formatMoney(card.balanceCents)} /> à utiliser
            </p>
            {card.expiresAt && (
              <p className="text-sm leading-5 text-ink-muted">
                Jusqu'au {formatGiftCardDate(card.expiresAt, timeZone)}
              </p>
            )}
          </div>
          <span className="flex h-[30px] shrink-0 items-center rounded-lg border border-dashed border-accent-strong px-2.5 font-mono text-meta font-medium leading-4 text-accent-strong">
            {card.code}
          </span>
        </div>
      ))}
      <p className="text-sm leading-5 text-ink-muted">
        {cards.length > 1 && `${formatMoney(total)} au total. `}
        Il s'applique tout seul à ta prochaine réservation : saisis le code au moment de réserver.
      </p>
    </section>
  );
}
