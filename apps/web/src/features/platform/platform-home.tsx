import { PageHeader } from "@/components/app/page-header";
import { DataTable } from "@/components/ui/data-table";
import { SearchInput } from "@/components/ui/search-input";
import { Stat, StatGrid } from "@/components/ui/stat";
import type { getPlatformHome } from "@/functions/platform";
import { useRouter } from "@/lib/navigation";
import { PlanBadge, PlatformTabs, shortDay } from "./shared";

type Data = Awaited<ReturnType<typeof getPlatformHome>>;

/** Cockpit : les chiffres de la plateforme et tous les espaces. */
export function PlatformHomePage({ data }: { data: Data }) {
  const router = useRouter();
  const { stats } = data;
  return (
    <>
      <PageHeader
        eyebrow="Horaya / Cockpit"
        title="Cockpit"
        subtitle={
          <>
            Tous les espaces et tous les comptes,{" "}
            <span className="text-ink">réservé à l'équipe Horaya.</span>
          </>
        }
        toolbar={
          <>
            <PlatformTabs value="espaces" />
            <form
              className="min-w-0 lg:flex-1 xl:max-w-[300px]"
              onSubmit={(event) => {
                event.preventDefault();
                const q = String(new FormData(event.currentTarget).get("q") ?? "").trim();
                router.push(q ? `/app/plateforme?q=${encodeURIComponent(q)}` : "/app/plateforme");
              }}
            >
              <SearchInput
                label="Rechercher un espace"
                name="q"
                defaultValue={data.query}
                placeholder="Nom, adresse, e-mail du propriétaire…"
              />
            </form>
          </>
        }
      />
      <div className="flex flex-col gap-4 pb-6">
        <StatGrid>
          <Stat
            label="Espaces"
            value={stats.workspaces}
            footer={`+${stats.newWorkspaces} en 30 jours`}
          />
          <Stat label="Comptes" value={stats.users} />
          <Stat label="Espaces abonnés" value={stats.paying} />
          <Stat label="Réservations" value={stats.bookings} footer="sur 30 jours" />
        </StatGrid>
        <DataTable
          label="Espaces"
          rows={data.rows}
          rowKey={(row) => row.id}
          rowHref={(row) => `/app/plateforme/espaces/${row.id}`}
          minWidth={900}
          empty={
            <p className="px-4 py-10 text-center text-base font-medium text-ink-muted">
              Aucun espace ne correspond.
            </p>
          }
          columns={[
            {
              key: "name",
              header: "Espace",
              cell: (row) => (
                <span className="flex min-w-0 flex-col">
                  <span className="truncate text-sm font-semibold text-ink">{row.name}</span>
                  <span className="truncate font-mono text-xs text-ink-subtle">/{row.slug}</span>
                </span>
              ),
            },
            {
              key: "owner",
              header: "Propriétaire",
              cell: (row) => (
                <span className="flex min-w-0 flex-col">
                  <span className="truncate text-sm text-ink">{row.ownerName ?? "—"}</span>
                  <span className="truncate text-xs text-ink-subtle">{row.ownerEmail}</span>
                </span>
              ),
            },
            {
              key: "plan",
              header: "Formule",
              width: 170,
              cell: (row) => <PlanBadge current={row.current} />,
            },
            {
              key: "members",
              header: "Membres",
              width: 90,
              align: "right",
              hideBelow: "xl",
              cell: (row) => <span className="text-sm text-ink">{row.members}</span>,
            },
            {
              key: "bookings",
              header: "Résa. 30 j",
              width: 100,
              align: "right",
              cell: (row) => <span className="text-sm text-ink">{row.recentBookings}</span>,
            },
            {
              key: "created",
              header: "Créé le",
              width: 120,
              align: "right",
              cell: (row) => (
                <span className="text-sm text-ink-muted">{shortDay(row.createdAt)}</span>
              ),
            },
          ]}
          card={(row) => (
            <div className="flex items-center gap-3">
              <div className="flex min-w-0 flex-1 flex-col">
                <span className="truncate text-ui font-semibold text-ink">{row.name}</span>
                <span className="truncate text-xs text-ink-subtle">
                  {row.ownerEmail ?? `/${row.slug}`} · {row.recentBookings} résa. en 30 j
                </span>
              </div>
              <PlanBadge current={row.current} />
            </div>
          )}
        />
      </div>
    </>
  );
}
