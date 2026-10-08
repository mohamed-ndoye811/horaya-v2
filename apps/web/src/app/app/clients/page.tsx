import {
  type CustomerSegment,
  countCustomersBySegment,
  getCustomerStats,
  listCustomers,
} from "@horaya/db";
import type { Metadata } from "next";
import { FabLink } from "@/components/app/fab";
import { PageHeader } from "@/components/app/page-header";
import { ButtonLink } from "@/components/ui/button";
import { PersonCell } from "@/components/ui/cells";
import { DataTable } from "@/components/ui/data-table";
import { EmptyState } from "@/components/ui/empty-state";
import { PlusIcon } from "@/components/ui/icons";
import { ActionMenu } from "@/components/ui/menu";
import { SearchInput } from "@/components/ui/search-input";
import { SegmentedLinks } from "@/components/ui/segmented";
import { Stat, StatGrid } from "@/components/ui/stat";
import { Tag } from "@/components/ui/tag";
import { customerTags } from "@/lib/customer-tags";
import { startOfDay, todayIn } from "@/lib/dates";
import { formatMoney } from "@/lib/format";
import { param, withParams } from "@/lib/search-params";
import { db } from "@/server/db";
import { getWorkspaceContext } from "@/server/workspace";

export const metadata: Metadata = { title: "Clients · Horaya" };

const SEGMENTS: Array<{ value: CustomerSegment; label: string }> = [
  { value: "all", label: "Tous" },
  { value: "vip", label: "VIP" },
  { value: "company", label: "Entreprises" },
  { value: "inactive", label: "Inactifs" },
];

function visitLabel(date: Date, timeZone: string) {
  return new Intl.DateTimeFormat("fr-FR", {
    weekday: "short",
    day: "numeric",
    month: "short",
    timeZone,
  })
    .format(date)
    .replace(/^./, (letter) => letter.toUpperCase());
}

/** Écran 22 : clients de l'espace. */
export default async function CustomersPage({ searchParams }: PageProps<"/app/clients">) {
  const { workspace, timeZone } = await getWorkspaceContext();
  const query = await searchParams;
  const segment = SEGMENTS.find((entry) => entry.value === param(query.segment))?.value ?? "all";
  const search = param(query.q);
  const now = new Date();
  const today = todayIn(timeZone, now);

  const [rows, counts, stats] = await Promise.all([
    listCustomers(db, workspace.id, { segment, now, search }),
    countCustomersBySegment(db, workspace.id, now),
    getCustomerStats(db, workspace.id, startOfDay({ ...today, day: 1 }, timeZone)),
  ]);

  const href = (overrides: Record<string, string | undefined>) =>
    withParams("/app/clients", {
      segment: segment === "all" ? undefined : segment,
      q: search,
      ...overrides,
    });

  return (
    <>
      <PageHeader
        eyebrow="Tableau de bord / Clients"
        title="Clients"
        subtitle={`${stats.total} client${stats.total > 1 ? "s" : ""} · ${stats.newThisMonth} nouveau${stats.newThisMonth > 1 ? "x" : ""} ce mois-ci${stats.returnRate !== null ? ` · ${stats.returnRate} % reviennent au moins une fois` : ""}`}
        actions={
          <>
            <ButtonLink
              href={withParams("/app/clients/export", {
                segment: segment === "all" ? undefined : segment,
                q: search,
              })}
              variant="secondary"
              prefetch={false}
            >
              Exporter
            </ButtonLink>
            <div className="hidden lg:flex">
              <ButtonLink href="/app/clients/nouveau" icon={<PlusIcon />}>
                Ajouter un client
              </ButtonLink>
            </div>
          </>
        }
      />
      <StatGrid>
        <Stat
          label="Clients"
          value={stats.total}
          footer={`▲ +${stats.newThisMonth} ce mois-ci`}
          footerTone={stats.newThisMonth > 0 ? "success" : "muted"}
        />
        <Stat
          label="Panier moyen"
          value={stats.averageBasketCents === null ? "—" : formatMoney(stats.averageBasketCents)}
          footer="par réservation payante"
        />
        <Stat
          label="Taux de retour"
          value={stats.returnRate === null ? "—" : `${stats.returnRate}%`}
          footer="au moins deux réservations"
        />
        <Stat
          label="Clients VIP"
          value={counts.vip}
          footer="5 réservations ou plus, ou étiquette VIP"
        />
      </StatGrid>

      {counts.all === 0 ? (
        <EmptyState
          title="Pas encore de client."
          description="Chaque personne qui réserve devient un client, avec son historique. Tu peux aussi en ajouter à la main."
          actions={
            <ButtonLink href="/app/clients/nouveau" arrow>
              Ajouter un client
            </ButtonLink>
          }
        />
      ) : (
        <>
          <div className="flex flex-col gap-4 px-4 py-6 sm:px-10 xl:flex-row xl:items-center">
            <form action="/app/clients" className="xl:flex-1">
              {segment !== "all" && <input type="hidden" name="segment" value={segment} />}
              <SearchInput
                label="Rechercher un client"
                name="q"
                defaultValue={search}
                placeholder="Rechercher un nom, un e-mail, une entreprise…"
              />
            </form>
            <SegmentedLinks
              collapse
              label="Filtrer les clients"
              value={segment}
              segments={SEGMENTS.map((entry) => ({
                ...entry,
                count: counts[entry.value],
                href: href({ segment: entry.value === "all" ? undefined : entry.value }),
              }))}
            />
          </div>
          <DataTable
            label="Clients"
            rows={rows}
            rowKey={(row) => row.id}
            minWidth={1000}
            empty={
              <p className="px-4 py-10 text-center text-base font-medium text-ink-muted sm:px-10">
                Aucun client ne correspond.
              </p>
            }
            card={(row) => (
              <div className="flex items-center gap-3.5">
                <div className="min-w-0 flex-1">
                  <PersonCell
                    name={`${row.firstName} ${row.lastName}`}
                    href={`/app/clients/${row.id}`}
                    stretched
                    detail={[
                      row.company,
                      `${row.bookings} résa.`,
                      row.lastVisit ? visitLabel(row.lastVisit, timeZone).toLowerCase() : null,
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  />
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1.5">
                  <span className="text-base font-extrabold leading-5 text-ink">
                    {formatMoney(row.spentCents)}
                  </span>
                  {customerTags(row, now)
                    .slice(0, 1)
                    .map((tag) => (
                      <Tag key={tag.label} tone={tag.tone}>
                        {tag.label}
                      </Tag>
                    ))}
                </div>
              </div>
            )}
            columns={[
              {
                key: "client",
                header: "Client",
                cell: (row) => (
                  <PersonCell
                    name={`${row.firstName} ${row.lastName}`}
                    detail={[row.email, row.company].filter(Boolean).join(" · ")}
                    href={`/app/clients/${row.id}`}
                  />
                ),
              },
              {
                key: "bookings",
                header: "Réservations",
                width: 120,
                align: "right",
                cell: (row) => (
                  <span className="font-mono text-sm font-semibold">{row.bookings}</span>
                ),
              },
              {
                key: "spent",
                header: "Dépensé",
                width: 110,
                align: "right",
                cell: (row) => (
                  <span className="text-[15px] font-extrabold text-ink">
                    {formatMoney(row.spentCents)}
                  </span>
                ),
              },
              {
                key: "visit",
                header: "Dernière venue",
                width: 170,
                cell: (row) => (
                  <span
                    className={
                      row.lastVisit
                        ? "text-sm font-medium text-ink"
                        : "text-sm font-medium text-ink-muted"
                    }
                  >
                    {row.lastVisit
                      ? visitLabel(row.lastVisit, timeZone)
                      : row.nextVisit
                        ? `Première le ${visitLabel(row.nextVisit, timeZone).toLowerCase()}`
                        : "—"}
                  </span>
                ),
              },
              {
                key: "tags",
                header: "Étiquettes",
                width: 210,
                cell: (row) => (
                  <div className="flex flex-wrap gap-1.5">
                    {customerTags(row, now).map((tag) => (
                      <Tag key={tag.label} tone={tag.tone}>
                        {tag.label}
                      </Tag>
                    ))}
                  </div>
                ),
              },
              {
                key: "actions",
                header: <span className="sr-only">Actions</span>,
                width: 64,
                align: "right",
                cell: (row) => (
                  <ActionMenu
                    label={`Actions pour ${row.firstName} ${row.lastName}`}
                    items={[
                      { label: "Voir la fiche", href: `/app/clients/${row.id}` },
                      {
                        label: "Créer une réservation",
                        href: `/app/reservations/nouvelle?client=${row.id}`,
                      },
                      { label: "Modifier", href: `/app/clients/${row.id}/modifier` },
                    ]}
                  />
                ),
              },
            ]}
          />
          <FabLink href="/app/clients/nouveau">Ajouter un client</FabLink>
        </>
      )}
    </>
  );
}
