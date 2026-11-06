import type { ItemTab } from "@horaya/db";
import type { ReactNode } from "react";
import { FabLink } from "@/components/app/fab";
import { ItemTile } from "@/components/app/item-tile";
import { PageHeader } from "@/components/app/page-header";
import { StatusBadge, type Tone } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { DataTable } from "@/components/ui/data-table";
import { EmptyState } from "@/components/ui/empty-state";
import { PlusIcon } from "@/components/ui/icons";
import { ProgressBar } from "@/components/ui/progress";
import { SearchInput } from "@/components/ui/search-input";
import { SegmentedLinks } from "@/components/ui/segmented";
import { MiniStat } from "@/components/ui/stat";
import type { getInventory } from "@/functions/inventory";
import { cn } from "@/lib/cn";
import { formatDateTimeShort, formatMoney, formatRelativeDateTime } from "@/lib/format";
import { Link, useRouter } from "@/lib/navigation";
import { withParams } from "@/lib/search-params";
import { ImportItemsButton } from "./import-items";

const TABS: Array<{ value: ItemTab; label: string }> = [
  { value: "all", label: "Tous" },
  { value: "available", label: "Disponible" },
  { value: "out", label: "En location" },
  { value: "maintenance", label: "Maintenance" },
];
const MONTHS = [
  "janvier",
  "février",
  "mars",
  "avril",
  "mai",
  "juin",
  "juillet",
  "août",
  "septembre",
  "octobre",
  "novembre",
  "décembre",
];

/** Évolution en % par rapport au mois dernier à la même date (null sans point de comparaison). */
function revenueTrend(current: number, previous: number): number | null {
  if (previous === 0) return null;
  return Math.round(((current - previous) / previous) * 100);
}

/** Écran 20 : inventaire du matériel. */
export function InventoryPage({
  data,
  filters,
}: {
  data: Awaited<ReturnType<typeof getInventory>>;
  filters: { filtre?: ItemTab; q?: string };
}) {
  const router = useRouter();
  const { timeZone, today, rows, counts, stats } = data;
  const tab = filters.filtre ?? "all";
  const search = filters.q;
  const now = new Date();
  const trend = revenueTrend(stats.rentalRevenueCents, stats.previousRentalRevenueCents);
  const href = (overrides: Record<string, string | undefined>) =>
    withParams("/app/materiel", {
      filtre: tab === "all" ? undefined : tab,
      q: search,
      ...overrides,
    });

  return (
    <>
      <PageHeader
        eyebrow="Tableau de bord / Matériel"
        title="Matériel"
        subtitle={
          <>
            {stats.items} article{stats.items > 1 ? "s" : ""}.{" "}
            <span className="text-ink">
              {stats.outNow} en location aujourd'hui, {stats.maintenanceUnits} à réviser.
            </span>
          </>
        }
        actions={
          <>
            <ImportItemsButton />
            <div className="hidden lg:flex">
              <ButtonLink href="/app/materiel/nouveau" icon={<PlusIcon />}>
                Ajouter un article
              </ButtonLink>
            </div>
          </>
        }
        toolbar={
          counts.all > 0 && (
            <>
              <form
                className="min-w-0 md:flex-1 xl:max-w-[280px]"
                onSubmit={(event) => {
                  event.preventDefault();
                  const q = String(new FormData(event.currentTarget).get("q") ?? "").trim();
                  router.push(href({ q: q || undefined }));
                }}
              >
                <SearchInput
                  label="Rechercher un article"
                  name="q"
                  defaultValue={search}
                  placeholder="Article, référence…"
                />
              </form>
              <SegmentedLinks
                collapse
                label="Filtrer le matériel"
                value={tab}
                segments={TABS.map((entry) => ({
                  ...entry,
                  count: counts[entry.value],
                  alert: entry.value === "maintenance",
                  href: href({ filtre: entry.value === "all" ? undefined : entry.value }),
                }))}
              />
            </>
          )
        }
      />
      <div className="grid grid-cols-2 gap-3 px-4 pb-4 xl:grid-cols-4">
        <MiniStat
          label="Articles"
          value={stats.items}
          aside={`dans ${stats.types} catégorie${stats.types > 1 ? "s" : ""}`}
        />
        <MiniStat
          label="En location aujourd'hui"
          value={stats.outNow}
          aside={
            stats.returnsToday > 0 && (
              <span className="inline-flex h-[22px] items-center rounded-full bg-info-bg px-2.5 text-xs font-bold text-info">
                {stats.returnsToday} retour{stats.returnsToday > 1 ? "s" : ""} ce soir
              </span>
            )
          }
        />
        <MiniStat
          dark
          label={`Revenus location · ${MONTHS[today.month - 1]}`}
          badge={
            trend !== null && (
              <span
                className={cn(
                  "inline-flex h-5 items-center rounded-full px-[7px] text-[11px] font-bold leading-[14px]",
                  trend >= 0 ? "bg-[#7cc29e]/15 text-[#7cc29e]" : "bg-danger/20 text-[#e59a9a]",
                )}
              >
                {trend >= 0 ? "+" : "−"}
                {Math.abs(trend)} %
              </span>
            )
          }
          value={formatMoney(stats.rentalRevenueCents).replace(/\s?€$/, "")}
          unit="€"
        />
        <MiniStat
          warning={stats.maintenanceUnits > 0}
          label="À réviser"
          value={stats.maintenanceUnits}
          aside={
            stats.maintenanceUnits > 0 ? (
              <Link
                href={href({ filtre: "maintenance" })}
                className="text-[13px] font-semibold leading-[17px] hover:underline"
              >
                Planifier la maintenance →
              </Link>
            ) : (
              "Aucune intervention prévue"
            )
          }
        />
      </div>

      {counts.all === 0 ? (
        <EmptyState
          title="Pas encore de matériel."
          description="Ajoute ton matériel (vidéoprojecteurs, micros, mobilier…) : tu pourras le réserver pour tes événements ou le louer, sans jamais prêter deux fois le même exemplaire."
          actions={
            <ButtonLink href="/app/materiel/nouveau" arrow>
              Ajouter un article
            </ButtonLink>
          }
        />
      ) : (
        <>
          <DataTable
            label="Matériel"
            rows={rows}
            rowKey={(row) => row.id}
            rowHref={(row) => `/app/materiel/${row.id}`}
            minWidth={1060}
            rowTone={(row) =>
              row.units > 0 && row.inMaintenanceNow >= row.units ? "warning" : undefined
            }
            empty={
              <p className="px-4 py-10 text-center text-base font-medium text-ink-muted">
                Aucun article ne correspond.
              </p>
            }
            card={(row) => (
              <div className="flex gap-3.5">
                <ItemTile
                  name={row.name}
                  reference={row.reference}
                  maintenance={row.inMaintenanceNow > 0 && row.availableNow === 0}
                />
                <div className="flex min-w-0 flex-1 flex-col gap-2.5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex min-w-0 flex-col gap-1">
                      <Link
                        href={`/app/materiel/${row.id}`}
                        className="text-sm font-semibold leading-[18px] text-ink after:absolute after:inset-0 hover:underline"
                      >
                        {row.name}
                      </Link>
                      <span className="text-xs leading-4 text-ink-subtle">
                        Réf. {row.reference}
                        {row.typeName ? ` · ${row.typeName}` : ""}
                      </span>
                    </div>
                    {row.dailyRateCents !== null && (
                      <span className="shrink-0 text-sm font-semibold leading-[18px] text-ink">
                        {formatMoney(row.dailyRateCents)}
                        <span className="text-xs font-medium text-ink-muted"> /j</span>
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="min-w-0 flex-1">
                      <Availability row={row} />
                    </div>
                    <ItemStatus row={row} />
                  </div>
                  <NextOuting row={row} now={now} timeZone={timeZone} />
                </div>
              </div>
            )}
            columns={[
              {
                key: "item",
                header: "Article",
                cell: (row) => (
                  <div className="flex min-w-0 items-center gap-3">
                    <ItemTile
                      name={row.name}
                      reference={row.reference}
                      maintenance={row.inMaintenanceNow > 0 && row.availableNow === 0}
                    />
                    <div className="flex min-w-0 flex-col gap-px">
                      <Link
                        href={`/app/materiel/${row.id}`}
                        className="truncate text-sm font-semibold leading-[18px] text-ink hover:underline"
                      >
                        {row.name}
                      </Link>
                      <span className="truncate text-xs leading-4 text-ink-subtle">
                        Réf. {row.reference}
                      </span>
                    </div>
                  </div>
                ),
              },
              {
                key: "type",
                header: "Type",
                width: 130,
                cell: (row) => (
                  <span className="truncate text-[13px] leading-[17px] text-[#4a4a4a]">
                    {row.typeName ?? "—"}
                  </span>
                ),
              },
              {
                key: "available",
                header: "Disponible",
                width: 190,
                cell: (row) => <Availability row={row} />,
              },
              {
                key: "rate",
                header: "Par jour",
                width: 90,
                align: "right",
                cell: (row) => (
                  <span className="text-sm font-semibold leading-[18px] text-ink">
                    {row.dailyRateCents === null ? "—" : formatMoney(row.dailyRateCents)}
                  </span>
                ),
              },
              {
                key: "next",
                header: "Prochaine sortie",
                width: 250,
                cell: (row) => <NextOuting row={row} now={now} timeZone={timeZone} />,
              },
              {
                key: "status",
                header: "Statut",
                width: 130,
                align: "right",
                cell: (row) => <ItemStatus row={row} />,
              },
            ]}
          />
          <FabLink href="/app/materiel/nouveau">Ajouter</FabLink>
        </>
      )}
    </>
  );
}

type ItemListRow = Awaited<ReturnType<typeof getInventory>>["rows"][number];

function Availability({ row }: { row: ItemListRow }) {
  return (
    <div className="flex w-full items-center gap-2.5">
      <span className="w-12 shrink-0 text-[13px] font-semibold leading-[17px] text-ink">
        {row.availableNow} <span className="font-normal text-ink-subtle">/ {row.units}</span>
      </span>
      <ProgressBar
        className="flex-1"
        value={row.availableNow}
        max={row.units}
        tone={row.availableNow / Math.max(1, row.units) < 0.5 ? "warning" : "success"}
        label={`${row.availableNow} exemplaires disponibles sur ${row.units}`}
      />
    </div>
  );
}

function ItemStatus({ row }: { row: ItemListRow }) {
  const badge: { label: ReactNode; tone: Tone } =
    row.units > 0 && row.inMaintenanceNow >= row.units
      ? { label: "Maintenance", tone: "warning" }
      : row.availableNow === 0
        ? { label: "En location", tone: "info" }
        : {
            label: (
              <>
                <span aria-hidden="true" className="mr-1.5 size-1.5 rounded-full bg-success" />
                Disponible
              </>
            ),
            tone: "success",
          };
  return <StatusBadge tone={badge.tone}>{badge.label}</StatusBadge>;
}

/** Prochaine sortie, ou retour attendu si l'article est dehors. */
function NextOuting({ row, now, timeZone }: { row: ItemListRow; now: Date; timeZone: string }) {
  if (!row.nextStartsAt || !row.nextEndsAt)
    return <span className="text-sm text-[#ababa6]">—</span>;
  const current = row.nextStartsAt <= now;
  const maintenance = row.nextKind === "maintenance";
  const title = row.nextTitle ?? (maintenance ? "Maintenance" : "Réservé");
  return (
    <div className="flex min-w-0 flex-col gap-px pl-6">
      <span
        className={cn(
          "truncate text-[13px] font-semibold leading-[17px]",
          maintenance ? "text-warning" : current ? "text-info" : "text-ink",
        )}
      >
        {current && !maintenance
          ? `Retour ${formatRelativeDateTime(row.nextEndsAt, timeZone, now).replace(/^(Aujourd'hui|Hier)/, (word) => word.toLowerCase())}`
          : title}
      </span>
      <span className="truncate text-xs leading-4 text-ink-subtle">
        {current && !maintenance
          ? title
          : current
            ? `Jusqu'au ${formatDateTimeShort(row.nextEndsAt, timeZone)}`
            : formatDateTimeShort(row.nextStartsAt, timeZone)}
      </span>
    </div>
  );
}
