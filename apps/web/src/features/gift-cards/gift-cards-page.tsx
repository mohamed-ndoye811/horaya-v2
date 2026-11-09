import { PageHeader } from "@/components/app/page-header";
import { StatusBadge } from "@/components/ui/badge";
import { Banner } from "@/components/ui/banner";
import { ButtonLink } from "@/components/ui/button";
import { DataTable } from "@/components/ui/data-table";
import { EmptyState } from "@/components/ui/empty-state";
import { PlusIcon } from "@/components/ui/icons";
import { ProgressBar } from "@/components/ui/progress";
import { SearchInput } from "@/components/ui/search-input";
import { SegmentedLinks } from "@/components/ui/segmented";
import { MiniStat } from "@/components/ui/stat";
import type { getGiftCards, giftCardsSearch } from "@/functions/gift-cards";
import { formatMoney, plural } from "@/lib/format";
import { formatGiftCardDate, GIFT_CARD_STATE } from "@/lib/gift-card";
import { Link, useRouter } from "@/lib/navigation";
import { withParams } from "@/lib/search-params";
import { SellGiftCardDialog } from "./sell-form";

type Search = ReturnType<(typeof giftCardsSearch)["parse"]>;
type State = NonNullable<Search["etat"]>;

const FILTERS: Array<{ value: State | "all"; label: string }> = [
  { value: "all", label: "Tous" },
  { value: "active", label: "Actifs" },
  { value: "pending", label: "À payer" },
  { value: "used", label: "Épuisés" },
  { value: "expired", label: "Expirés" },
];

/**
 * Bons cadeaux : à quoi ils servent, les chiffres (à honorer, actifs, à marquer payés, vendus ce
 * mois-ci), puis les bons filtrés par statut. La vente au comptoir se fait dans une fenêtre
 * (`?vendre=1`).
 */
export function GiftCardsPage({
  data,
  search,
}: {
  data: Awaited<ReturnType<typeof getGiftCards>>;
  search: Search;
}) {
  const router = useRouter();
  const { cards, enabled, amountsCents, timeZone } = data;
  const { q, etat } = search;
  const href = (params: Partial<Record<keyof Search, string | undefined>>) =>
    withParams("/app/bons-cadeaux", { q, etat, ...params });

  const count = (state: State) => cards.filter((card) => card.state === state).length;
  const outstanding = cards
    .filter((card) => card.state === "active")
    .reduce((sum, card) => sum + card.balanceCents, 0);
  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);
  const soldThisMonth = cards
    .filter(
      (card) =>
        new Date(card.createdAt) >= monthStart &&
        card.state !== "pending" &&
        card.state !== "cancelled",
    )
    .reduce((sum, card) => sum + card.initialCents, 0);
  const rows = etat ? cards.filter((card) => card.state === etat) : cards;
  const nothing = cards.length === 0 && !q;
  const sellHref = href({ vendre: "1" });

  return (
    <>
      <PageHeader
        eyebrow="Tableau de bord / Bons cadeaux"
        title="Bons cadeaux"
        subtitle="Un montant à offrir, que le bénéficiaire dépense sur tes réservations. Vendus sur ta page publique ou au comptoir."
        actions={
          <>
            <ButtonLink href="/app/parametres/bons-cadeaux" variant="secondary">
              Réglages
            </ButtonLink>
            <ButtonLink href={sellHref} icon={<PlusIcon />}>
              Vendre un bon
            </ButtonLink>
          </>
        }
        toolbar={
          !nothing && (
            <>
              <form
                className="min-w-0 lg:flex-1 lg:basis-60 xl:max-w-[280px]"
                onSubmit={(event) => {
                  event.preventDefault();
                  const value = String(new FormData(event.currentTarget).get("q") ?? "").trim();
                  router.push(href({ q: value || undefined }));
                }}
              >
                <SearchInput
                  label="Rechercher un bon"
                  name="q"
                  defaultValue={q}
                  placeholder="Code, acheteur, bénéficiaire…"
                />
              </form>
              <SegmentedLinks
                collapse
                label="Filtrer par statut"
                value={etat ?? "all"}
                // Statuts vides masqués (sauf le filtre en cours) : la barre reste courte.
                segments={FILTERS.filter(
                  (filter) =>
                    filter.value === "all" || filter.value === etat || count(filter.value) > 0,
                ).map((filter) => ({
                  ...filter,
                  count: filter.value === "all" ? cards.length : count(filter.value),
                  alert: filter.value === "pending",
                  href: href({ etat: filter.value === "all" ? undefined : filter.value }),
                }))}
              />
            </>
          )
        }
      />
      {!enabled && (
        <div className="pb-4">
          <Banner
            tone="info"
            action={<Link href="/app/parametres/bons-cadeaux">Les proposer</Link>}
          >
            <strong>Pas encore sur ta page publique.</strong> Tu peux vendre des bons au comptoir ;
            active-les pour que tes clients en achètent en ligne.
          </Banner>
        </div>
      )}
      {nothing ? (
        <EmptyState
          title="Pas encore de bon cadeau à offrir."
          description="Un bon, c'est un montant offert : le bénéficiaire le dépense en réservant chez toi, en une ou plusieurs fois, jusqu'à son échéance."
          steps={[
            "Choisis les montants proposés",
            "On l'achète sur ta page, ou tu le vends au comptoir",
            "Le bénéficiaire le dépense en réservant",
          ]}
          actions={
            <ButtonLink href={sellHref} arrow>
              Vendre un bon
            </ButtonLink>
          }
        />
      ) : (
        <div className="flex flex-col gap-4 pb-4">
          <div className="grid grid-cols-2 gap-3 px-4 xl:grid-cols-4">
            <MiniStat
              dark
              label="À honorer"
              value={formatMoney(outstanding)}
              aside={<span className="text-on-ink-muted">sur les bons actifs</span>}
            />
            <MiniStat
              label="Bons actifs"
              value={count("active")}
              aside={`sur ${plural(cards.length, "bon")}`}
            />
            <MiniStat
              warning={count("pending") > 0}
              label="À marquer payés"
              value={count("pending")}
              aside={count("pending") > 0 ? "achetés en ligne" : "tout est réglé"}
            />
            <MiniStat label="Vendus ce mois-ci" value={formatMoney(soldThisMonth)} />
          </div>
          <DataTable
            label="Bons cadeaux"
            rows={rows}
            rowKey={(row) => row.id}
            rowHref={(row) => `/app/bons-cadeaux/${row.id}`}
            minWidth={820}
            empty={
              <p className="px-4 py-10 text-center text-base font-medium text-ink-muted">
                Aucun bon ne correspond.
              </p>
            }
            card={(row) => (
              <div className="flex flex-col gap-2">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex min-w-0 flex-col gap-0.5">
                    <span className="truncate text-sm font-semibold text-ink">
                      Pour {row.recipientName}
                    </span>
                    <span className="truncate text-meta text-ink-muted">
                      de {row.purchaserName} · <span className="font-mono">{row.code}</span>
                    </span>
                  </div>
                  <StatusBadge tone={GIFT_CARD_STATE[row.state].tone} size="sm">
                    {GIFT_CARD_STATE[row.state].label}
                  </StatusBadge>
                </div>
                <Balance balance={row.balanceCents} initial={row.initialCents} />
              </div>
            )}
            columns={[
              {
                key: "who",
                header: "Bon",
                cell: (row) => (
                  <span className="flex flex-col gap-0.5">
                    <span className="text-sm font-semibold text-ink">Pour {row.recipientName}</span>
                    <span className="text-meta text-ink-muted">de {row.purchaserName}</span>
                  </span>
                ),
              },
              {
                key: "code",
                header: "Code",
                width: 170,
                cell: (row) => (
                  <span className="flex flex-col gap-0.5">
                    <span className="font-mono text-meta font-medium text-ink">{row.code}</span>
                    <span className="text-xs text-ink-subtle">
                      {row.source === "counter" ? "Comptoir" : "En ligne"} ·{" "}
                      {formatGiftCardDate(new Date(row.createdAt), timeZone)}
                    </span>
                  </span>
                ),
              },
              {
                key: "balance",
                header: "Solde",
                width: 190,
                cell: (row) => <Balance balance={row.balanceCents} initial={row.initialCents} />,
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
                key: "expires",
                header: "Échéance",
                width: 130,
                cell: (row) => (
                  <span className="text-meta text-ink-soft">
                    {row.expiresAt ? formatGiftCardDate(new Date(row.expiresAt), timeZone) : "—"}
                  </span>
                ),
              },
            ]}
          />
        </div>
      )}
      {search.vendre && (
        <SellGiftCardDialog
          amountsCents={amountsCents}
          onClose={() => router.push(href({ vendre: undefined }))}
        />
      )}
    </>
  );
}

/** Solde restant sur le montant de départ, avec sa jauge. */
function Balance({ balance, initial }: { balance: number; initial: number }) {
  return (
    <span className="flex flex-col gap-1.5">
      <span className="text-sm font-semibold text-ink">
        {formatMoney(balance)}
        <span className="font-normal text-ink-subtle"> / {formatMoney(initial)}</span>
      </span>
      <ProgressBar
        value={balance}
        max={initial}
        label={`${formatMoney(balance)} restants sur ${formatMoney(initial)}`}
        className="w-36"
      />
    </span>
  );
}
