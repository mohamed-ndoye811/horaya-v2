import { PageHeader } from "@/components/app/page-header";
import { Button, ButtonLink } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import type { getNewEvent } from "@/functions/events";
import { EventForm } from "./event-form";

/** Écran 09 : création d'un événement (ou d'une série). */
export function NewEventPage({ data }: { data: Awaited<ReturnType<typeof getNewEvent>> }) {
  const { timeZone, types, initial } = data;

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
      />
      <EventForm
        formId="event-form"
        eventId={null}
        types={types}
        timeZone={timeZone}
        initial={initial}
        actions={
          <>
            <Button
              type="submit"
              form="event-form"
              name="intent"
              value="draft"
              variant="inverse-outline"
            >
              <span className="lg:hidden">Brouillon</span>
              <span className="hidden lg:inline">Enregistrer en brouillon</span>
            </Button>
            <Button type="submit" form="event-form" name="intent" value="publish" variant="inverse">
              <span>
                Publier<span className="hidden sm:inline"> l'événement</span>
              </span>
            </Button>
          </>
        }
      />
    </>
  );
}
