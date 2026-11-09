import { useState } from "react";
import { PageHeader } from "@/components/app/page-header";
import { StatusBadge } from "@/components/ui/badge";
import { DataTable } from "@/components/ui/data-table";
import { FormAlert } from "@/components/ui/form-alert";
import { ActionMenu } from "@/components/ui/menu";
import { SearchInput } from "@/components/ui/search-input";
import {
  deletePlatformUser,
  type getPlatformUsers,
  impersonatePlatformUser,
  suspendPlatformUser,
} from "@/functions/platform";
import { Link, useRouter } from "@/lib/navigation";
import type { FormState } from "@/server/form-state";
import { PlatformTabs, shortDay } from "./shared";

type Data = Awaited<ReturnType<typeof getPlatformUsers>>;

/** Cockpit : tous les comptes et leurs espaces. */
export function PlatformUsersPage({ data }: { data: Data }) {
  const router = useRouter();
  const [message, setMessage] = useState<FormState>({});
  type Row = Data["rows"][number];

  async function act(run: () => Promise<FormState>) {
    setMessage(await run());
    router.refresh();
  }

  const actions = (row: Row) => (
    <ActionMenu
      label={`Actions pour ${row.name}`}
      items={[
        {
          label: "Se connecter en tant que",
          onSelect: async () => {
            const result = await impersonatePlatformUser({ data: row.id }).catch(() => null);
            // Succès : la fonction répond par une redirection ; on recharge pour changer de session.
            if (result?.error) setMessage(result);
            else window.location.assign("/app");
          },
        },
        row.banned
          ? {
              label: "Réactiver le compte",
              onSelect: () =>
                act(() => suspendPlatformUser({ data: { userId: row.id, suspended: false } })),
            }
          : {
              label: "Suspendre le compte",
              onSelect: () =>
                act(() => suspendPlatformUser({ data: { userId: row.id, suspended: true } })),
            },
        {
          label: "Supprimer le compte",
          tone: "danger",
          onSelect: () => {
            if (
              window.confirm(`Supprimer définitivement le compte de ${row.name} (${row.email}) ?`)
            ) {
              act(() => deletePlatformUser({ data: row.id }));
            }
          },
        },
      ]}
    />
  );
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
      <div className="flex flex-col gap-3 pb-6">
        {(message.error || message.success) && (
          <div className="px-4">
            <FormAlert tone={message.error ? "danger" : "success"}>
              {message.error ?? message.success}
            </FormAlert>
          </div>
        )}
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
                row.banned ? (
                  <StatusBadge tone="danger" size="sm">
                    Suspendu
                  </StatusBadge>
                ) : row.emailVerified ? (
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
            {
              key: "actions",
              header: <span className="sr-only">Actions</span>,
              width: 56,
              align: "right",
              cell: actions,
            },
          ]}
          card={(row) => (
            <div className="flex items-start gap-3">
              <div className="flex min-w-0 flex-1 flex-col gap-1">
                <span className="truncate text-ui font-semibold text-ink">{row.name}</span>
                <span className="truncate text-xs text-ink-subtle">
                  {row.email}
                  {row.emailVerified ? "" : " · à confirmer"}
                </span>
                <Workspaces list={row.workspaces} />
              </div>
              {actions(row)}
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
