import { countEventsByTab, type EventTab, listEvents, listEventTypes } from "@horaya/db";
import type { Metadata } from "next";
import { FilterSelect } from "@/components/app/filter-select";
import { PageHeader } from "@/components/app/page-header";
import { StatusBadge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { DateBlock, EventCell } from "@/components/ui/cells";
import { DataTable } from "@/components/ui/data-table";
import { EmptyState } from "@/components/ui/empty-state";
import { PlusIcon } from "@/components/ui/icons";
import { ActionMenu } from "@/components/ui/menu";
import { fillTone, ProgressBar } from "@/components/ui/progress";
import { SearchInput } from "@/components/ui/search-input";
import { SegmentedLinks } from "@/components/ui/segmented";
import { eventStatusBadge } from "@/components/ui/status";
import { formatTimeRange, formatWeekdayShort } from "@/lib/format";
import { param, withParams } from "@/lib/search-params";
import { db } from "@/server/db";
import { getWorkspaceContext } from "@/server/workspace";

export const metadata: Metadata = { title: "Événements · Horaya" };

const TABS: Array<{ value: EventTab; label: string }> = [
  { value: "all", label: "Tous" },
  { value: "published", label: "Publiés" },
  { value: "draft", label: "Brouillons" },
  { value: "past", label: "Passés" },
];

/** Écran 04 : liste des événements ; écran 28 quand il n'y en a encore aucun. */
export default async function EventsPage({ searchParams }: PageProps<"/app/evenements">) {
  const { workspace, timeZone } = await getWorkspaceContext();
  const query = await searchParams;
  const tab = (TABS.find((entry) => entry.value === param(query.onglet))?.value ??
    "all") as EventTab;
  const search = param(query.q);
  const typeId = param(query.type);
  const now = new Date();

  const [counts, events, types] = await Promise.all([
    countEventsByTab(db, workspace.id, now),
    listEvents(db, workspace.id, { tab, now, search, typeId }),
    listEventTypes(db, workspace.id),
  ]);

  const newEventButton = (
    <ButtonLink href="/app/evenements/nouveau" icon={<PlusIcon />}>
      Nouvel événement
    </ButtonLink>
  );

  if (counts.all === 0) {
    return (
      <>
        <PageHeader
          eyebrow="Tableau de bord / Événements"
          title="Événements"
          subtitle="0 événement · ton agenda attend son premier rendez-vous"
          actions={newEventButton}
        />
        <EmptyState
          title="Rien à l'agenda. Pour l'instant."
          description="Crée ton premier événement : il apparaîtra dans ton calendrier et sur ta page publique, prêt à recevoir des réservations."
          actions={
            <>
              <ButtonLink href="/app/evenements/nouveau" arrow>
                Créer mon premier événement
              </ButtonLink>
              <ButtonLink href="/app/evenements/types" variant="secondary">
                Préparer mes types d'événements
              </ButtonLink>
            </>
          }
          steps={["Crée un événement", "Partage ta page publique", "Reçois tes réservations"]}
        />
      </>
    );
  }

  const href = (overrides: Record<string, string | undefined>) =>
    withParams("/app/evenements", {
      onglet: tab === "all" ? undefined : tab,
      q: search,
      type: typeId,
      ...overrides,
    });

  return (
    <>
      <PageHeader
        eyebrow="Tableau de bord / Événements"
        title="Événements"
        subtitle={`${counts.all} événement${counts.all > 1 ? "s" : ""} · ${counts.published} à venir · ${counts.draft} brouillon${counts.draft > 1 ? "s" : ""}`}
        actions={
          <>
            <ButtonLink href="/app/evenements/liens" variant="secondary">
              Liens calendrier
            </ButtonLink>
            <ButtonLink href="/app/evenements/types" variant="secondary">
              Types d'événements
            </ButtonLink>
            {newEventButton}
          </>
        }
      />

      <div className="flex flex-col gap-4 px-4 py-6 sm:px-10 xl:flex-row xl:items-center">
        <form action="/app/evenements" className="xl:flex-1">
          {tab !== "all" && <input type="hidden" name="onglet" value={tab} />}
          {typeId && <input type="hidden" name="type" value={typeId} />}
          <SearchInput
            label="Rechercher un événement"
            name="q"
            defaultValue={search}
            placeholder="Rechercher un événement, un lieu, un type…"
          />
        </form>
        <SegmentedLinks
          label="Filtrer les événements"
          value={tab}
          segments={TABS.map((entry) => ({
            ...entry,
            count: counts[entry.value],
            href: href({ onglet: entry.value === "all" ? undefined : entry.value }),
          }))}
        />
        <FilterSelect
          param="type"
          label="Type d'événement"
          className="xl:w-[200px]"
          options={[
            { value: "", label: "Tous les types" },
            ...types.map((type) => ({ value: type.id, label: type.name })),
          ]}
        />
      </div>

      <DataTable
        label="Événements"
        rows={events}
        rowKey={(row) => row.id}
        minWidth={1000}
        empty={
          <p className="px-4 py-10 text-center text-base font-medium text-ink-muted sm:px-10">
            Aucun événement ne correspond à ces filtres.
          </p>
        }
        columns={[
          {
            key: "date",
            header: "Date",
            width: 124,
            cell: (row) => <DateBlock date={row.startsAt} timeZone={timeZone} layout="day-first" />,
          },
          {
            key: "event",
            header: "Événement",
            cell: (row) => (
              <EventCell
                title={row.title}
                color={row.typeColor}
                href={`/app/evenements/${row.id}`}
                detail={`${formatWeekdayShort(row.startsAt, timeZone)} ${formatTimeRange(row.startsAt, row.endsAt, timeZone)}${row.visibility === "invite_only" ? " · Sur invitation" : ""}`}
              />
            ),
          },
          {
            key: "type",
            header: "Type",
            width: 130,
            cell: (row) => (
              <span className="truncate text-[15px] font-semibold text-ink">{row.typeName}</span>
            ),
          },
          {
            key: "location",
            header: "Lieu",
            width: 170,
            cell: (row) => (
              <span className="truncate text-[15px] font-medium text-ink">
                {row.locationName ?? (row.onlineUrl ? "En ligne" : "—")}
              </span>
            ),
          },
          {
            key: "seats",
            header: "Places",
            width: 150,
            cell: (row) => (
              <div className="flex w-full flex-col gap-1.5">
                <span className="font-mono text-sm font-semibold text-ink">
                  {row.seatsHeld} / {row.capacity ?? "∞"}
                </span>
                {row.capacity !== null && (
                  <ProgressBar
                    value={row.seatsHeld}
                    max={row.capacity}
                    tone={fillTone(row.seatsHeld, row.capacity)}
                    label={`${row.seatsHeld} places réservées sur ${row.capacity}`}
                  />
                )}
              </div>
            ),
          },
          {
            key: "status",
            header: "Statut",
            width: 160,
            align: "right",
            cell: (row) => {
              const badge =
                row.endsAt < now && row.status === "published"
                  ? { label: "Passé", tone: "draft" as const }
                  : eventStatusBadge(row.status, row);
              return <StatusBadge tone={badge.tone}>{badge.label}</StatusBadge>;
            },
          },
          {
            key: "actions",
            header: <span className="sr-only">Actions</span>,
            width: 64,
            align: "right",
            cell: (row) => (
              <ActionMenu
                label={`Actions pour ${row.title}`}
                items={[
                  { label: "Voir l'événement", href: `/app/evenements/${row.id}` },
                  ...(row.status === "cancelled"
                    ? []
                    : [{ label: "Modifier", href: `/app/evenements/${row.id}/modifier` }]),
                ]}
              />
            ),
          },
        ]}
      />
    </>
  );
}
