import { PageHeader } from "@/components/app/page-header";
import { StatusBadge } from "@/components/ui/badge";
import { DataTable } from "@/components/ui/data-table";
import { SearchInput } from "@/components/ui/search-input";
import type { getPlatformUsers } from "@/functions/platform";
import { Link, useRouter } from "@/lib/navigation";
import { PlatformTabs, shortDay } from "./shared";

type Data = Awaited<ReturnType<typeof getPlatformUsers>>;

/** Cockpit : tous les comptes et leurs espaces. */
export function PlatformUsersPage({ data }: { data: Data }) {
  const router = useRouter();
  return (
    <>
      <PageHeader
        eyebrow="Horaya / Cockpit"
        title="Comptes"
        subtitle={
          <>
            {data.rows.length} compte{data.rows.length > 1 ? "s" : ""}
            {data.query ? " trouvés" : ", les plus récents d'abord"}.
          </>
        }
        toolbar={
          <>
            <PlatformTabs value="comptes" />
            <form
              className="min-w-0 lg:flex-1 xl:max-w-[300px]"
              onSubmit={(event) => {
                event.preventDefault();
                const q = String(new FormData(event.currentTarget).get("q") ?? "").trim();
                router.push(
                  q
                    ? `/app/plateforme/utilisateurs?q=${encodeURIComponent(q)}`
                    : "/app/plateforme/utilisateurs",
                );
              }}
            >
              <SearchInput
                label="Rechercher un compte"
                name="q"
                defaultValue={data.query}
                placeholder="Nom, e-mail…"
              />
            </form>
          </>
        }
      />
      <div className="pb-6">
        <DataTable
          label="Comptes"
          rows={data.rows}
          rowKey={(row) => row.id}
          minWidth={860}
          empty={
            <p className="px-4 py-10 text-center text-base font-medium text-ink-muted">
              Aucun compte ne correspond.
            </p>
          }
          columns={[
            {
              key: "name",
              header: "Compte",
              cell: (row) => (
                <span className="flex min-w-0 flex-col">
                  <span className="truncate text-sm font-semibold text-ink">{row.name}</span>
                  <span className="truncate text-xs text-ink-subtle">{row.email}</span>
                </span>
              ),
            },
            {
              key: "workspaces",
              header: "Espaces",
              cell: (row) => <Workspaces list={row.workspaces} />,
            },
            {
              key: "verified",
              header: "E-mail",
              width: 130,
              cell: (row) =>
                row.emailVerified ? (
                  <StatusBadge tone="success" size="sm">
                    Confirmé
                  </StatusBadge>
                ) : (
                  <StatusBadge tone="warning" size="sm">
                    À confirmer
                  </StatusBadge>
                ),
            },
            {
              key: "created",
              header: "Inscrit le",
              width: 120,
              align: "right",
              cell: (row) => (
                <span className="text-sm text-ink-muted">{shortDay(row.createdAt)}</span>
              ),
            },
          ]}
          card={(row) => (
            <div className="flex min-w-0 flex-col gap-1">
              <span className="truncate text-[15px] font-semibold text-ink">{row.name}</span>
              <span className="truncate text-xs text-ink-subtle">
                {row.email}
                {row.emailVerified ? "" : " · à confirmer"}
              </span>
              <Workspaces list={row.workspaces} />
            </div>
          )}
        />
      </div>
    </>
  );
}

function Workspaces({ list }: { list: Array<{ id: string; name: string; role: string }> }) {
  if (list.length === 0) return <span className="text-sm text-ink-faint">Aucun</span>;
  return (
    <span className="flex flex-wrap gap-x-2 gap-y-1 text-sm">
      {list.map((workspace) => (
        <Link
          key={workspace.id}
          href={`/app/plateforme/espaces/${workspace.id}`}
          className="relative z-10 font-semibold text-ink underline-offset-2 hover:underline"
        >
          {workspace.name}
          {workspace.role === "owner" ? " (propriétaire)" : ""}
        </Link>
      ))}
    </span>
  );
}
