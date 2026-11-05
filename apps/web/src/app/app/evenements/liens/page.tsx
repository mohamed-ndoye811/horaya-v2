import { can } from "@horaya/core";
import { listCalendarLinks, listEventTypes, listLinkableEvents } from "@horaya/db";
import type { Metadata } from "next";
import { PageHeader } from "@/components/app/page-header";
import { Banner } from "@/components/ui/banner";
import { EmptyState } from "@/components/ui/empty-state";
import { formatShortDateTime } from "@/lib/format";
import { db } from "@/server/db";
import { env } from "@/server/env";
import { getWorkspaceContext } from "@/server/workspace";
import {
  CalendarLinksTable,
  type LinkChoices,
  type LinkRow,
  NewLinkButton,
} from "./calendar-links";

export const metadata: Metadata = { title: "Liens calendrier · Horaya" };

/**
 * Liens calendrier (repris de la v1, sans maquette) : des pages publiques qui ne
 * montrent qu'une partie des événements, et qui valent invitation.
 */
export default async function CalendarLinksPage() {
  const { workspace, actor, timeZone } = await getWorkspaceContext();
  const now = new Date();
  const [links, types, events] = await Promise.all([
    listCalendarLinks(db, workspace.id, now),
    listEventTypes(db, workspace.id),
    listLinkableEvents(db, workspace.id, now),
  ]);
  const editable = actor.type === "member" && can(actor.role, "event", "publish");
  const canDelete = actor.type === "member" && can(actor.role, "event", "delete");

  const typeNames = new Map(types.map((type) => [type.id, type.name]));
  const eventTitles = new Map(events.map((entry) => [entry.id, entry.title]));
  const summary = (link: (typeof links)[number]) => {
    if (link.filterMode === "all") return "Tous les événements";
    const names = link.filterIds
      .map((id) => (link.filterMode === "event_types" ? typeNames.get(id) : eventTitles.get(id)))
      .filter(Boolean);
    if (link.filterMode === "event_types") return names.join(", ") || "Types supprimés";
    return names.length === 1
      ? (names[0] ?? "")
      : `${link.filterIds.length} événements${names.length ? ` : ${names.slice(0, 2).join(", ")}${names.length > 2 ? "…" : ""}` : ""}`;
  };
  const rows: LinkRow[] = links.map((link) => ({
    id: link.id,
    name: link.name,
    url: new URL(`/${workspace.slug}/calendrier/${link.slug}`, env.BETTER_AUTH_URL).toString(),
    filterMode: link.filterMode,
    filterIds: link.filterIds,
    summary: summary(link),
    upcomingEvents: link.upcomingEvents,
    isActive: link.isActive,
  }));
  const choices: LinkChoices = {
    types: types.map((type) => ({ id: type.id, name: type.name, color: type.color })),
    events: events.map((entry) => ({
      id: entry.id,
      title: entry.title,
      date: formatShortDateTime(entry.startsAt, timeZone),
      inviteOnly: entry.visibility === "invite_only",
      draft: entry.status === "draft",
    })),
  };

  return (
    <>
      <PageHeader
        eyebrow="Événements / Liens calendrier"
        title="Liens calendrier"
        subtitle={
          <>
            {rows.length} lien{rows.length > 1 ? "s" : ""} ·{" "}
            <span className="text-ink">
              une page qui ne montre qu'une partie de tes événements.
            </span>
          </>
        }
        actions={editable ? <NewLinkButton choices={choices} /> : undefined}
      />
      <div className="pb-4">
        <Banner tone="info">
          <strong>Partage un lien</strong> par type ou au choix : il vaut invitation pour les
          événements « Sur invitation » qu'il contient.
        </Banner>
      </div>
      {rows.length === 0 ? (
        <EmptyState
          title="Pas encore de lien calendrier."
          description="Crée un lien pour partager seulement certains événements : les ateliers d'un client, le programme d'un groupe, des sessions privées sur invitation."
        />
      ) : editable ? (
        <div>
          <CalendarLinksTable links={rows} choices={choices} canDelete={canDelete} />
        </div>
      ) : (
        <ul className="flex flex-col px-4">
          {rows.map((row) => (
            <li key={row.id} className="flex flex-col gap-1 border-b border-line-soft py-4">
              <span className="text-sm font-semibold text-ink">{row.name}</span>
              <span className="font-mono text-xs text-ink-subtle">{row.url}</span>
              <span className="text-[13px] text-[#4a4a4a]">{row.summary}</span>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
