import { addDays } from "@horaya/core";
import { getInventoryStats, type ItemTab, listItems } from "@horaya/db";
import type { Metadata } from "next";
import Link from "next/link";
import { FabLink } from "@/components/app/fab";
import { ItemTile } from "@/components/app/item-tile";
import { PageHeader } from "@/components/app/page-header";
import { StatusBadge, type Tone } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { MonoCaption } from "@/components/ui/cells";
import { DataTable } from "@/components/ui/data-table";
import { EmptyState } from "@/components/ui/empty-state";
import { PlusIcon } from "@/components/ui/icons";
import { ProgressBar } from "@/components/ui/progress";
import { SearchInput } from "@/components/ui/search-input";
import { SegmentedLinks } from "@/components/ui/segmented";
import { Stat, StatGrid } from "@/components/ui/stat";
import { cn } from "@/lib/cn";
import { addMonths, startOfDay, todayIn } from "@/lib/dates";
import { formatDateTimeShort, formatMoney } from "@/lib/format";
import { param, withParams } from "@/lib/search-params";
import { db } from "@/server/db";
import { getWorkspaceContext } from "@/server/workspace";
import { ImportItemsButton } from "./import-items";

export const metadata: Metadata = { title: "Matériel · Horaya" };

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
export default async function InventoryPage({ searchParams }: PageProps<"/app/materiel">) {
  const { workspace, timeZone } = await getWorkspaceContext();
  const query = await searchParams;
  const tab = TABS.find((entry) => entry.value === param(query.filtre))?.value ?? "all";
  const search = param(query.q);
  const now = new Date();
  const today = todayIn(timeZone, now);
  const previousMonth = addMonths({ ...today, day: 1 }, -1);

  const [rows, all, stats] = await Promise.all([
    listItems(db, workspace.id, { tab, now, search }),
    listItems(db, workspace.id, { tab: "all", now }),
    getInventoryStats(db, workspace.id, {
      now,
      dayEnd: startOfDay(addDays(today, 1), timeZone),
      monthStart: startOfDay({ ...today, day: 1 }, timeZone),
      previousMonthStart: startOfDay(previousMonth, timeZone),
    }),
  ]);
  const counts: Record<ItemTab, number> = {
    all: all.length,
    available: all.filter((row) => row.availableNow > 0).length,
    out: all.filter((row) => row.availableNow < row.units - row.inMaintenanceNow).length,
    maintenance: all.filter((row) => row.inMaintenanceNow > 0).length,
  };
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
        subtitle={`${stats.items} article${stats.items > 1 ? "s" : ""} · ${stats.outNow} en location aujourd'hui · ${stats.maintenanceUnits} à réviser`}
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
      />
      <StatGrid>
        <Stat
          label="Articles"
          value={stats.items}
          footer={`dans ${stats.types} catégorie${stats.types > 1 ? "s" : ""}`}
        />
        <Stat
          label="En location aujourd'hui"
          value={stats.outNow}
          footer={
            stats.returnsToday > 0
              ? `${stats.returnsToday} retour${stats.returnsToday > 1 ? "s" : ""} prévu${stats.returnsToday > 1 ? "s" : ""} ce soir`
              : "Aucun retour prévu ce soir"
          }
        />
        <Stat
          label={`Revenus location · ${MONTHS[today.month - 1]}`}
          value={formatMoney(stats.rentalRevenueCents)}
          footer={
            trend === null
              ? "Locations confirmées"
              : `${trend >= 0 ? "▲ +" : "▼ −"}${Math.abs(trend)} % vs ${MONTHS[previousMonth.month - 1]}`
          }
          footerTone={trend === null ? "muted" : trend >= 0 ? "success" : "danger"}
        />
        <Stat
          label="À réviser"
          value={stats.maintenanceUnits}
          highlight={stats.maintenanceUnits > 0 ? "warning" : false}
          footer={
            stats.maintenanceUnits > 0 ? (
              <Link
                href={href({ filtre: "maintenance" })}
                className="font-bold underline decoration-1 underline-offset-[3px]"
              >
                Planifier la maintenance →
              </Link>
            ) : (
              "Aucune intervention prévue"
            )
          }
        />
      </StatGrid>

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
          <div className="flex flex-col gap-4 px-4 py-6 sm:px-10 xl:flex-row xl:items-center">
            <form action="/app/materiel" className="xl:flex-1">
              {tab !== "all" && <input type="hidden" name="filtre" value={tab} />}
              <SearchInput
                label="Rechercher un article"
                name="q"
                defaultValue={search}
                placeholder="Rechercher un article, une référence…"
              />
            </form>
            <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
              <SegmentedLinks
                label="Filtrer le matériel"
                value={tab}
                segments={TABS.map((entry) => ({
                  ...entry,
                  count: counts[entry.value],
                  href: href({ filtre: entry.value === "all" ? undefined : entry.value }),
                }))}
              />
            </div>
          </div>
          <DataTable
            label="Matériel"
            rows={rows}
            rowKey={(row) => row.id}
            minWidth={1060}
            empty={
              <p className="px-4 py-10 text-center text-base font-medium text-ink-muted sm:px-10">
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
                        className="text-base font-bold leading-5 text-ink hover:underline"
                      >
                        {row.name}
                      </Link>
                      <MonoCaption>
                        Réf. {row.reference}
                        {row.typeName ? ` · ${row.typeName}` : ""}
                      </MonoCaption>
                    </div>
                    {row.dailyRateCents !== null && (
                      <span className="shrink-0 text-[15px] font-extrabold leading-5 text-ink">
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
                  <div className="flex min-w-0 items-center gap-3.5">
                    <ItemTile
                      name={row.name}
                      reference={row.reference}
                      maintenance={row.inMaintenanceNow > 0 && row.availableNow === 0}
                    />
                    <div className="flex min-w-0 flex-col gap-1">
                      <Link
                        href={`/app/materiel/${row.id}`}
                        className="truncate text-base font-bold text-ink hover:underline"
                      >
                        {row.name}
                      </Link>
                      <MonoCaption>Réf. {row.reference}</MonoCaption>
                    </div>
                  </div>
                ),
              },
              {
                key: "type",
                header: "Type",
                width: 130,
                cell: (row) => (
                  <span className="truncate text-[15px] font-semibold text-ink">
                    {row.typeName ?? "—"}
                  </span>
                ),
              },
              {
                key: "available",
                header: "Disponible",
                width: 150,
                cell: (row) => <Availability row={row} />,
              },
              {
                key: "rate",
                header: "Par jour",
                width: 100,
                align: "right",
                cell: (row) => (
                  <span className="text-[15px] font-extrabold text-ink">
                    {row.dailyRateCents === null ? "—" : formatMoney(row.dailyRateCents)}
                  </span>
                ),
              },
              {
                key: "next",
                header: "Prochaine sortie",
                width: 230,
                cell: (row) => <NextOuting row={row} now={now} timeZone={timeZone} />,
              },
              {
                key: "status",
                header: "Statut",
                width: 150,
                align: "right",
                cell: (row) => <ItemStatus row={row} />,
              },
            ]}
          />
          <FabLink href="/app/materiel/nouveau">Ajouter un article</FabLink>
        </>
      )}
    </>
  );
}

type ItemListRow = Awaited<ReturnType<typeof listItems>>[number];

function Availability({ row }: { row: ItemListRow }) {
  return (
    <div className="flex w-full flex-col gap-1.5">
      <span className="font-mono text-sm font-semibold text-ink">
        {row.availableNow} / {row.units}
      </span>
      <ProgressBar
        value={row.availableNow}
        max={row.units}
        tone={
          row.availableNow === 0
            ? "draft"
            : row.availableNow / row.units < 0.5
              ? "warning"
              : "success"
        }
        label={`${row.availableNow} exemplaires disponibles sur ${row.units}`}
      />
    </div>
  );
}

function ItemStatus({ row }: { row: ItemListRow }) {
  const badge: { label: string; tone: Tone } =
    row.units > 0 && row.inMaintenanceNow >= row.units
      ? { label: "Maintenance", tone: "warning" }
      : row.availableNow === 0
        ? { label: "En location", tone: "info" }
        : { label: "Disponible", tone: "success" };
  return <StatusBadge tone={badge.tone}>{badge.label}</StatusBadge>;
}

/** Prochaine sortie, ou retour attendu si l'article est dehors. */
function NextOuting({ row, now, timeZone }: { row: ItemListRow; now: Date; timeZone: string }) {
  if (!row.nextStartsAt || !row.nextEndsAt)
    return <span className="text-sm font-medium text-ink-muted">—</span>;
  const current = row.nextStartsAt <= now;
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <span
        className={cn(
          "truncate text-sm font-semibold",
          row.nextKind === "maintenance" ? "text-warning" : "text-ink",
        )}
      >
        {row.nextTitle ?? (row.nextKind === "maintenance" ? "Maintenance" : "Réservé")}
      </span>
      <MonoCaption>
        {current
          ? `Retour ${formatDateTimeShort(row.nextEndsAt, timeZone)}`
          : formatDateTimeShort(row.nextStartsAt, timeZone)}
      </MonoCaption>
    </div>
  );
}
