import { StatusBadge } from "@/components/ui/badge";
import { Button, ButtonLink } from "@/components/ui/button";
import type { getGiftCardView } from "@/functions/gift-cards";
import { cn } from "@/lib/cn";
import { displayFontClass } from "@/lib/fonts";
import { formatMoney } from "@/lib/format";
import { formatGiftCardDate, GIFT_CARD_STATE } from "@/lib/gift-card";

/**
 * Page du bon, aux couleurs de l'atelier : confirmation juste après l'achat (avec le bouton
 * de paiement tant que l'organisateur n'a pas marqué le bon payé), puis version imprimable.
 */
export function GiftCardView({
  data: { workspace, card, workspaceMessage },
  justPurchased,
}: {
  data: Awaited<ReturnType<typeof getGiftCardView>>;
  justPurchased: boolean;
}) {
  const state = GIFT_CARD_STATE[card.state];
  const pending = card.state === "pending";
  const link = workspace.paymentLinkUrl;
  return (
    <div className="mx-auto flex w-full max-w-[640px] flex-col gap-4 py-2">
      {pending && (
        <section className="flex flex-col gap-3 rounded-3xl bg-surface p-6 print:hidden">
          <h1 className="text-xl font-semibold leading-[26px] text-ink">
            {justPurchased ? "Ton bon est réservé, il reste à le payer" : "En attente de paiement"}
          </h1>
          <p className="text-[15px] leading-[23px] text-ink-muted">
            {link
              ? `Règle ${formatMoney(card.initialCents)} via le lien de paiement de ${workspace.name}. Le bon devient actif dès que ${workspace.name} a confirmé la réception, et tu reçois alors son e-mail.`
              : `${workspace.name} va te contacter pour le paiement. Le bon devient actif dès que la réception est confirmée.`}
          </p>
          {link && (
            <div>
              <ButtonLink href={link} target="_blank" rel="noreferrer" variant="brand" size="xl">
                Payer {formatMoney(card.initialCents)} ↗
              </ButtonLink>
            </div>
          )}
        </section>
      )}
      <article
        aria-label="Bon cadeau"
        className="flex flex-col gap-8 rounded-3xl p-8 text-on-ink print:border print:border-black print:!bg-white print:text-black"
        style={{
          background:
            "radial-gradient(circle at 85% 10%, color-mix(in srgb, var(--brand) 55%, transparent), transparent 60%), var(--color-ink)",
        }}
      >
        <div className="flex items-start justify-between gap-4">
          <p className="text-[13px] font-semibold leading-4 text-[var(--brand-light)] print:text-black">
            Bon cadeau · {workspace.name}
          </p>
          <span className="print:hidden">
            <StatusBadge tone={state.tone}>{state.label}</StatusBadge>
          </span>
        </div>
        <div className="flex flex-col gap-1">
          <p
            className={cn(
              "text-[64px] leading-[64px] tracking-[-0.045em]",
              displayFontClass(workspace.displayFont),
            )}
          >
            {formatMoney(card.initialCents)}
          </p>
          <p className="text-[17px] leading-[25px] text-on-ink/85 print:text-black">
            Pour {card.recipientName}, de la part de {card.purchaserName}
          </p>
        </div>
        {card.message && (
          <p className="text-[17px] leading-[25px] italic text-on-ink/85 print:text-black">
            « {card.message} »
          </p>
        )}
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="flex flex-col gap-1.5">
            <p className="text-[13px] leading-4 text-on-ink-muted print:text-black">Code</p>
            <span className="rounded-lg border border-dashed border-[var(--brand-light)] px-3 py-2 font-mono text-xl font-medium leading-6 tracking-[0.04em] print:border-black">
              {card.code}
            </span>
          </div>
          {card.expiresAt && (
            <p className="text-sm leading-5 text-on-ink-muted print:text-black">
              Valable jusqu'au {formatGiftCardDate(card.expiresAt, workspace.timezone)}
            </p>
          )}
        </div>
        {workspaceMessage && (
          <p className="whitespace-pre-line border-t border-ink-line pt-4 text-[13px] leading-5 text-on-ink-muted print:border-black print:text-black">
            {workspaceMessage}
          </p>
        )}
      </article>
      <section className="flex flex-col gap-3 rounded-3xl bg-surface p-6 print:hidden">
        <p className="text-[15px] leading-[23px] text-ink">
          Pour l'utiliser, saisis le code dans le champ « J'ai un bon cadeau » en réservant un
          atelier. Le reste du solde est conservé pour la fois suivante.
        </p>
        <div className="flex flex-wrap gap-2.5">
          <Button variant="secondary" onClick={() => window.print()}>
            Imprimer le bon
          </Button>
          <ButtonLink href={`/${workspace.slug}`} variant="secondary">
            Voir les ateliers
          </ButtonLink>
        </div>
      </section>
    </div>
  );
}
