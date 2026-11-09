import { PageHeader } from "@/components/app/page-header";
import { Banner } from "@/components/ui/banner";
import { EmptyState } from "@/components/ui/empty-state";
import type { getCalendarLinks } from "@/functions/events";
import { CalendarLinksTable, NewLinkButton } from "./calendar-links";

/**
 * Liens calendrier (repris de la v1, sans maquette) : des pages publiques qui ne
 * montrent qu'une partie des événements, et qui valent invitation.
 */
export function CalendarLinksPage({
  data,
}: {
  data: Awaited<ReturnType<typeof getCalendarLinks>>;
}) {
  const { rows, choices, editable, canDelete } = data;
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
              <span className="text-meta text-ink-soft">{row.summary}</span>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
