import { getCustomerDetail, listBookableEvents } from "@horaya/db";
import type { Metadata } from "next";
import { PageHeader } from "@/components/app/page-header";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { formatDateTimeShort } from "@/lib/format";
import { param } from "@/lib/search-params";
import { db } from "@/server/db";
import { getWorkspaceContext } from "@/server/workspace";
import { NewBookingForm } from "./new-booking-form";

export const metadata: Metadata = { title: "Nouvelle réservation · Horaya" };

export default async function NewBookingPage({
  searchParams,
}: PageProps<"/app/reservations/nouvelle">) {
  const { workspace, timeZone } = await getWorkspaceContext();
  const query = await searchParams;
  const now = new Date();
  const [events, customer] = await Promise.all([
    listBookableEvents(db, workspace.id, now),
    param(query.client)
      ? getCustomerDetail(db, workspace.id, param(query.client) ?? "", now)
      : null,
  ]);

  return (
    <>
      <PageHeader
        eyebrow="Réservations / Nouvelle"
        title="Nouvelle réservation"
        subtitle="Inscris un client à un événement publié."
      />
      {events.length === 0 ? (
        <EmptyState
          title="Aucun événement ouvert."
          description="Publie d'abord un événement à venir : il apparaîtra ici pour y inscrire quelqu'un."
          actions={
            <ButtonLink href="/app/evenements" arrow>
              Voir mes événements
            </ButtonLink>
          }
        />
      ) : (
        <NewBookingForm
          initialEventId={param(query.evenement)}
          customer={customer?.customer}
          events={events.map((event) => ({
            id: event.id,
            title: event.title,
            priceCents: event.priceCents,
            remaining:
              event.capacity === null ? null : Math.max(0, event.capacity - event.seatsHeld),
            label: `${event.title} · ${formatDateTimeShort(event.startsAt, timeZone)}${event.capacity !== null && event.seatsHeld >= event.capacity ? " · complet" : ""}`,
          }))}
        />
      )}
    </>
  );
}
