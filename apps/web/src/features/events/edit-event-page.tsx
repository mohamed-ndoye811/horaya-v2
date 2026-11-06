import { PageHeader } from "@/components/app/page-header";
import { Button } from "@/components/ui/button";
import type { getEditEvent } from "@/functions/events";
import { EventForm } from "./event-form";

/** Modification d'un événement. */
export function EditEventPage({ data }: { data: Awaited<ReturnType<typeof getEditEvent>> }) {
  const { timeZone, event, types, initial } = data;
  return (
    <>
      <PageHeader
        eyebrow={`Événements / ${event.title} / Modifier`}
        title="Modifier"
        subtitle="Les changements de date et de lieu s'appliquent aussitôt sur la page publique."
      />
      <EventForm
        formId="event-form"
        eventId={event.id}
        types={types}
        timeZone={timeZone}
        initial={initial}
        actions={
          <>
            <Button
              type="submit"
              form="event-form"
              name="intent"
              value="save"
              variant={event.status === "draft" ? "inverse-outline" : "inverse"}
            >
              Enregistrer
            </Button>
            {event.status === "draft" && (
              <Button
                type="submit"
                form="event-form"
                name="intent"
                value="publish"
                variant="inverse"
              >
                <span className="lg:hidden">Publier</span>
                <span className="hidden lg:inline">Enregistrer et publier</span>
              </Button>
            )}
          </>
        }
      />
    </>
  );
}
