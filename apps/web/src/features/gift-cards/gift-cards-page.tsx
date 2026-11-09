import { PageHeader } from "@/components/app/page-header";
import { StatusBadge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { DataTable } from "@/components/ui/data-table";
import { EmptyState } from "@/components/ui/empty-state";
import { PlusIcon } from "@/components/ui/icons";
import { SearchInput } from "@/components/ui/search-input";
import type { getGiftCards } from "@/functions/gift-cards";
import { formatMoney } from "@/lib/format";
import { formatGiftCardDate, GIFT_CARD_STATE } from "@/lib/gift-card";
import { useRouter } from "@/lib/navigation";
import { withParams } from "@/lib/search-params";

/** Bons cadeaux vendus : statut, solde, échéance, acheteur, bénéficiaire. */
export function GiftCardsPage({
  data,
  search,
}: {
  data: Awaited<ReturnType<typeof getGiftCards>>;
  search?: string;
}) {
  const router = useRouter();
  const { cards, enabled, timeZone } = data;
  const toPay = cards.filter((card) => card.state === "pending").length;
  const outstanding = cards
    .filter((card) => card.state === "active")
    .reduce((sum, card) => sum + card.balanceCents, 0);

  return (
    <>
      <PageHeader
        eyebrow="Tableau de bord / Bons cadeaux"
        title="Bons cadeaux"
        subtitle={
          cards.length === 0 && !search ? (
            "Aucun bon vendu pour l'instant."
          ) : (
            <>
              {cards.length} bon{cards.length > 1 ? "s" : ""}.{" "}
              <span className="text-ink">
                {formatMoney(outstanding)} à honorer
                {toPay > 0 ? `, ${toPay} à marquer payé` : ""}.
              </span>
            </>
          )
        }
        actions={
          <>
            <ButtonLink href="/app/parametres/bons-cadeaux" variant="secondary">
              Réglages
            </ButtonLink>
            <ButtonLink href="/app/bons-cadeaux/nouveau" icon={<PlusIcon />}>
              Vendre un bon
            </ButtonLink>
          </>
        }
        toolbar={
          (cards.length > 0 || search) && (
            <form
              className="min-w-0 lg:flex-1 xl:max-w-[300px]"
              onSubmit={(event) => {
                event.preventDefault();
                const q = String(new FormData(event.currentTarget).get("q") ?? "").trim();
                router.push(withParams("/app/bons-cadeaux", { q: q || undefined }));
              }}
            >
              <SearchInput
                label="Rechercher un bon"
                name="q"
                defaultValue={search}
                placeholder="Code, acheteur, bénéficiaire…"
              />
            </form>
          )
        }
      />
      {cards.length === 0 && !search ? (
        <EmptyState
          title="Pas encore de bon cadeau à offrir."
          description={
            enabled
              ? "Les bons achetés sur ta page publique arrivent ici, à marquer payés. Tu peux aussi en vendre au comptoir."
              : "Active les bons cadeaux dans les réglages pour les proposer sur ta page publique, ou vends-en directement au comptoir."
          }
          actions={
            <ButtonLink
              href={enabled ? "/app/bons-cadeaux/nouveau" : "/app/parametres/bons-cadeaux"}
              arrow
            >
              {enabled ? "Vendre un bon" : "Régler les bons cadeaux"}
            </ButtonLink>
          }
        />
      ) : (
        <DataTable
          label="Bons cadeaux"
          rows={cards}
          rowKey={(row) => row.id}
          rowHref={(row) => `/app/bons-cadeaux/${row.id}`}
          minWidth={900}
          empty={
            <p className="px-4 py-10 text-center text-base font-medium text-ink-muted">
              Aucun bon ne correspond.
            </p>
          }
          card={(row) => (
            <div className="flex items-center justify-between gap-3">
              <div className="flex min-w-0 flex-col gap-0.5">
                <span className="font-mono text-sm font-medium text-ink">{row.code}</span>
                <span className="truncate text-meta text-ink-muted">
                  {row.purchaserName} → {row.recipientName}
                </span>
              </div>
              <div className="flex shrink-0 flex-col items-end gap-1.5">
                <span className="text-sm font-semibold text-ink">
                  {formatMoney(row.balanceCents)} / {formatMoney(row.initialCents)}
                </span>
                <StatusBadge tone={GIFT_CARD_STATE[row.state].tone} size="sm">
                  {GIFT_CARD_STATE[row.state].label}
                </StatusBadge>
              </div>
            </div>
          )}
          columns={[
            {
              key: "code",
              header: "Code",
              width: 150,
              cell: (row) => <span className="font-mono text-sm font-medium">{row.code}</span>,
            },
            {
              key: "state",
              header: "Statut",
              width: 120,
              cell: (row) => (
                <StatusBadge tone={GIFT_CARD_STATE[row.state].tone}>
                  {GIFT_CARD_STATE[row.state].label}
                </StatusBadge>
              ),
            },
            {
              key: "balance",
              header: "Solde",
              width: 160,
              cell: (row) => (
                <span className="text-sm font-semibold text-ink">
                  {formatMoney(row.balanceCents)}
                  <span className="font-normal text-ink-subtle">
                    {" "}
                    / {formatMoney(row.initialCents)}
                  </span>
                </span>
              ),
            },
            {
              key: "expires",
              header: "Échéance",
              width: 130,
              cell: (row) => (
                <span className="text-meta text-ink-soft">
                  {row.expiresAt ? formatGiftCardDate(row.expiresAt, timeZone) : "—"}
                </span>
              ),
            },
            {
              key: "purchaser",
              header: "Acheteur",
              cell: (row) => <span className="text-sm">{row.purchaserName}</span>,
            },
            {
              key: "recipient",
              header: "Bénéficiaire",
              cell: (row) => <span className="text-sm">{row.recipientName}</span>,
            },
          ]}
        />
      )}
    </>
  );
}
