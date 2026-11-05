import { addDays } from "@horaya/core";
import {
  countEventsByTab,
  type EventRow,
  type EventTab,
  listEvents,
  listEventTypes,
} from "@horaya/db";
import type { Metadata } from "next";
import Link from "next/link";
import { FabLink } from "@/components/app/fab";
import { FilterSelect } from "@/components/app/filter-select";
import { PageHeader } from "@/components/app/page-header";
import { StatusBadge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { DateBlock, EventCell, EventThumb } from "@/components/ui/cells";
import { DataTable } from "@/components/ui/data-table";
import { EmptyState } from "@/components/ui/empty-state";
import { PlusIcon } from "@/components/ui/icons";
import { ActionMenu } from "@/components/ui/menu";
import { fillTone, ProgressBar } from "@/components/ui/progress";
import { SearchInput } from "@/components/ui/search-input";
import { SegmentedLinks } from "@/components/ui/segmented";
import { eventStatusBadge } from "@/components/ui/status";
import { mondayOf, startOfDay, todayIn } from "@/lib/dates";
import { formatTimeRange } from "@/lib/format";
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

  const statusBadge = (row: (typeof events)[number]) =>
    row.endsAt < now && row.status === "published"
      ? { label: "Passé", tone: "draft" as const }
      : eventStatusBadge(row.status, row, now);

  const href = (overrides: Record<string, string | undefined>) =>
    withParams("/app/evenements", {
      onglet: tab === "all" ? undefined : tab,
      q: search,
      type: typeId,
      ...overrides,
    });

  // Bandeaux de la liste : cette semaine, la suivante, puis mois par mois.
  const monday = mondayOf(todayIn(timeZone, now));
  const thisWeek = startOfDay(monday, timeZone);
  const nextWeek = startOfDay(addDays(monday, 7), timeZone);
  const weekAfter = startOfDay(addDays(monday, 14), timeZone);
  const monthFormat = new Intl.DateTimeFormat("fr-FR", {
    month: "long",
    year: "numeric",
    timeZone,
  });
  const currentYear = new Intl.DateTimeFormat("fr-FR", { year: "numeric", timeZone }).format(now);
  const groupOf = (row: EventRow) => {
    if (row.startsAt >= thisWeek && row.startsAt < nextWeek) return "Cette semaine";
    if (row.startsAt >= nextWeek && row.startsAt < weekAfter) return "Semaine prochaine";
    const label = monthFormat.format(row.startsAt).replace(` ${currentYear}`, "");
    return `${label.charAt(0).toUpperCase()}${label.slice(1)}`;
  };

  const seatsCell = (row: EventRow, badgeTone: string) => (
    <div className="flex w-full items-center gap-3">
      <span className="w-14 shrink-0 text-sm text-ink-muted">
        <span className="font-semibold text-ink">
          {row.capacity === null && row.seatsHeld === 0 ? "—" : row.seatsHeld}
        </span>{" "}
        / {row.capacity ?? "∞"}
      </span>
      {row.capacity !== null && (
        <ProgressBar
          value={row.seatsHeld}
          max={row.capacity}
          tone={badgeTone === "danger" ? "danger" : "ink"}
          label={`${row.seatsHeld} places réservées sur ${row.capacity}`}
          className="flex-1"
        />
      )}
    </div>
  );

  return (
    <>
      <PageHeader
        eyebrow="Tableau de bord / Événements"
        title="Événements"
        subtitle={`${counts.all} événement${counts.all > 1 ? "s" : ""} · ${counts.published} à venir · ${counts.draft} brouillon${counts.draft > 1 ? "s" : ""}`}
        actions={
          <>
            {/* Sur mobile, ces pages sont dans l'onglet « Plus ». */}
            <div className="hidden gap-2 lg:flex">
              <ButtonLink href="/app/evenements/liens" variant="secondary" title="Liens calendrier">
                Calendriers
              </ButtonLink>
              <ButtonLink
                href="/app/evenements/types"
                variant="secondary"
                title="Types d'événements"
              >
                Types
              </ButtonLink>
            </div>
            <div className="hidden lg:flex">{newEventButton}</div>
          </>
        }
        toolbar={
          <>
            <form action="/app/evenements" className="min-w-0 md:flex-1 xl:max-w-[300px]">
              {tab !== "all" && <input type="hidden" name="onglet" value={tab} />}
              {typeId && <input type="hidden" name="type" value={typeId} />}
              <SearchInput
                label="Rechercher un événement"
                name="q"
                defaultValue={search}
                placeholder="Événement, lieu, type…"
              />
            </form>
            {/* Sur mobile, les pilules seules : la recherche couvre aussi les types. */}
            <div className="flex flex-col gap-3 md:flex-row md:items-center">
              <SegmentedLinks
                collapse
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
                className="hidden md:block md:w-[170px]"
                options={[
                  { value: "", label: "Tous les types" },
                  ...types.map((type) => ({ value: type.id, label: type.name })),
                ]}
              />
            </div>
          </>
        }
      />

      <DataTable
        label="Événements"
        rows={events}
        rowKey={(row) => row.id}
        rowHref={(row) => `/app/evenements/${row.id}`}
        group={groupOf}
        minWidth={1000}
        empty={
          <p className="px-4 py-10 text-center text-base font-medium text-ink-muted">
            Aucun événement ne correspond à ces filtres.
          </p>
        }
        card={(row) => {
          const badge = statusBadge(row);
          return (
            <div className="flex gap-3.5">
              <DateBlock date={row.startsAt} timeZone={timeZone} layout="day-first" />
              <div className="flex min-w-0 flex-1 flex-col gap-2">
                <EventCell
                  title={row.title}
                  color={row.typeColor}
                  href={`/app/evenements/${row.id}`}
                  stretched
                  detail={[
                    formatTimeRange(row.startsAt, row.endsAt, timeZone),
                    row.typeName,
                    row.locationName ?? (row.onlineUrl ? "En ligne" : null),
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                />
                <div className="flex items-center gap-3">
                  <div className="min-w-0 flex-1">{seatsCell(row, badge.tone)}</div>
                  <StatusBadge tone={badge.tone}>{badge.label}</StatusBadge>
                </div>
              </div>
            </div>
          );
        }}
        columns={[
          {
            key: "date",
            header: "Date",
            width: 76,
            cell: (row) => <DateBlock date={row.startsAt} timeZone={timeZone} layout="day-first" />,
          },
          {
            key: "event",
            header: "Événement",
            cell: (row) => (
              <div className="flex min-w-0 items-center gap-3">
                <EventThumb imageUrl={row.coverImageUrl} color={row.typeColor} />
                <div className="flex min-w-0 flex-col gap-0.5">
                  <Link
                    href={`/app/evenements/${row.id}`}
                    className="truncate text-[15px] font-semibold leading-5 text-ink hover:underline"
                  >
                    {row.title}
                  </Link>
                  <span className="truncate text-xs leading-4 text-ink-muted">
                    {formatTimeRange(row.startsAt, row.endsAt, timeZone)}
                    {row.visibility === "invite_only" ? " · Sur invitation" : ""}
                  </span>
                </div>
              </div>
            ),
          },
          {
            key: "type",
            header: "Type",
            width: 150,
            cell: (row) => (
              <span className="flex min-w-0 items-center gap-2 text-sm text-ink">
                <span
                  aria-hidden="true"
                  className="size-[7px] shrink-0 rounded-full"
                  style={{ backgroundColor: row.typeColor }}
                />
                <span className="truncate">{row.typeName}</span>
              </span>
            ),
          },
          {
            key: "location",
            header: "Lieu",
            width: 180,
            cell: (row) => (
              <span className="truncate text-sm text-ink">
                {row.locationName ?? (row.onlineUrl ? "En ligne" : "—")}
              </span>
            ),
          },
          {
            key: "seats",
            header: "Places",
            width: 200,
            cell: (row) => seatsCell(row, statusBadge(row).tone),
          },
          {
            key: "status",
            header: "Statut",
            width: 160,
            align: "right",
            cell: (row) => {
              const badge = statusBadge(row);
              return <StatusBadge tone={badge.tone}>{badge.label}</StatusBadge>;
            },
          },
          {
            key: "actions",
            header: <span className="sr-only">Actions</span>,
            width: 56,
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
      <FabLink href="/app/evenements/nouveau">Nouveau</FabLink>
    </>
  );
}
