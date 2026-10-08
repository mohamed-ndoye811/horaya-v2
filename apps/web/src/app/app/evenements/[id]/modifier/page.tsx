import { getEventDetail, listEventTypes } from "@horaya/db";
import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { PageHeader } from "@/components/app/page-header";
import { Button } from "@/components/ui/button";
import { db } from "@/server/db";
import { getWorkspaceContext } from "@/server/workspace";
import { EventForm } from "../../event-form";
import { eventToValues } from "../../form-values";

export const metadata: Metadata = { title: "Modifier l'événement · Horaya" };

export default async function EditEventPage({
  params,
}: PageProps<"/app/evenements/[id]/modifier">) {
  const { id } = await params;
  const { workspace, timeZone } = await getWorkspaceContext();
  const [detail, types] = await Promise.all([
    getEventDetail(db, workspace.id, id),
    listEventTypes(db, workspace.id),
  ]);
  if (!detail) notFound();
  if (detail.event.status === "cancelled") redirect(`/app/evenements/${id}`);
  const { event } = detail;
  // Le type actuel reste proposé même s'il a été archivé depuis.
  const options = types.some((type) => type.id === event.typeId)
    ? types
    : [
        ...types,
        {
          id: event.typeId,
          name: event.typeName,
          color: event.typeColor,
          defaultDurationMinutes: null,
          defaultPriceCents: null,
          defaultCapacity: null,
          requiresApproval: false,
        },
      ];

  return (
    <>
      <PageHeader
        eyebrow={`Événements / ${event.title} / Modifier`}
        title="Modifier"
        subtitle="Les changements de date et de lieu s'appliquent aussitôt sur la page publique."
        stickyActions="bottom"
        actions={
          <>
            <Button
              type="submit"
              form="event-form"
              name="intent"
              value="save"
              variant={event.status === "draft" ? "secondary" : "primary"}
            >
              Enregistrer
            </Button>
            {event.status === "draft" && (
              <Button type="submit" form="event-form" name="intent" value="publish">
                <span className="lg:hidden">Publier</span>
                <span className="hidden lg:inline">Enregistrer et publier</span>
              </Button>
            )}
          </>
        }
      />
      <EventForm
        formId="event-form"
        eventId={id}
        types={options}
        timeZone={timeZone}
        initial={eventToValues(event, timeZone)}
      />
    </>
  );
}
