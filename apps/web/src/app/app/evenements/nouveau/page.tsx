import { listEventTypes } from "@horaya/db";
import type { Metadata } from "next";
import { PageHeader } from "@/components/app/page-header";
import { Button, ButtonLink } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { parseCivilDate } from "@/lib/dates";
import { param } from "@/lib/search-params";
import { db } from "@/server/db";
import { getWorkspaceContext } from "@/server/workspace";
import { EventForm } from "../event-form";
import { emptyEventValues } from "../form-values";

export const metadata: Metadata = { title: "Nouvel événement · Horaya" };

/** Écran 09 : création d'un événement (ou d'une série). */
export default async function NewEventPage({ searchParams }: PageProps<"/app/evenements/nouveau">) {
  const { workspace, timeZone } = await getWorkspaceContext();
  const query = await searchParams;
  const types = await listEventTypes(db, workspace.id);
  const day = parseCivilDate(param(query.date)) ?? undefined;

  if (types.length === 0) {
    return (
      <>
        <PageHeader eyebrow="Événements / Nouveau" title="Nouvel événement" />
        <EmptyState
          title="D'abord, un type d'événement."
          description="Un type donne sa couleur à l'événement et ses réglages par défaut (durée, prix, validation). Crée-en un, puis reviens ici."
          actions={
            <ButtonLink href="/app/evenements/types?type=nouveau" arrow>
              Créer un type d'événement
            </ButtonLink>
          }
        />
      </>
    );
  }

  return (
    <>
      <PageHeader
        eyebrow="Événements / Nouveau"
        title="Nouvel événement"
        subtitle="Les champs marqués d'un astérisque sont obligatoires. Un brouillon n'est visible que par ton équipe."
        stickyActions="bottom"
        actions={
          <>
            <Button type="submit" form="event-form" name="intent" value="draft" variant="secondary">
              <span className="lg:hidden">Brouillon</span>
              <span className="hidden lg:inline">Enregistrer en brouillon</span>
            </Button>
            <Button type="submit" form="event-form" name="intent" value="publish">
              <span>
                Publier<span className="hidden sm:inline"> l'événement</span>
              </span>
            </Button>
          </>
        }
      />
      <EventForm
        formId="event-form"
        eventId={null}
        types={types}
        timeZone={timeZone}
        initial={emptyEventValues(timeZone, day)}
      />
    </>
  );
}
