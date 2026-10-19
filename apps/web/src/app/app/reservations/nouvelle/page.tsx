import { addDays } from "@horaya/core";
import { getCustomerDetail, listCounterEvents } from "@horaya/db";
import type { Metadata } from "next";
import { PageHeader } from "@/components/app/page-header";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { startOfDay, todayIn } from "@/lib/dates";
import { param } from "@/lib/search-params";
import { db } from "@/server/db";
import { getWorkspaceContext } from "@/server/workspace";
import { type CounterEvent, CounterWizard } from "./counter-wizard";

export const metadata: Metadata = { title: "Comptoir · Horaya" };

/** Durée lisible : « 2 h », « 1 h 30 », « 45 min ». */
function duration(startsAt: Date, endsAt: Date) {
  const minutes = Math.round((endsAt.getTime() - startsAt.getTime()) / 60_000);
  if (minutes < 60) return `${minutes} min`;
  const rest = minutes % 60;
  return rest
    ? `${Math.floor(minutes / 60)} h ${String(rest).padStart(2, "0")}`
    : `${minutes / 60} h`;
}

/**
 * Comptoir (maquettes 29a-c, M26-M29) : une réservation prise au téléphone ou sur place,
 * en trois étapes. Remplace l'ancien formulaire « Nouvelle réservation ».
 */
export default async function CounterPage({
  searchParams,
}: PageProps<"/app/reservations/nouvelle">) {
  const { workspace, timeZone } = await getWorkspaceContext();
  const query = await searchParams;
  const now = new Date();
  const today = todayIn(timeZone, now);
  const tomorrow = startOfDay(addDays(today, 1), timeZone);
  const afterTomorrow = startOfDay(addDays(today, 2), timeZone);
  const clientId = param(query.client);
  const [events, customer] = await Promise.all([
    listCounterEvents(db, workspace.id, { now, until: startOfDay(addDays(today, 60), timeZone) }),
    clientId ? getCustomerDetail(db, workspace.id, clientId, now) : null,
  ]);

  const clock = new Intl.DateTimeFormat("fr-FR", { hour: "2-digit", minute: "2-digit", timeZone });
  const weekday = new Intl.DateTimeFormat("fr-FR", {
    weekday: "short",
    day: "numeric",
    month: "short",
    timeZone,
  });
  const counterEvents: CounterEvent[] = events.map((event) => ({
    id: event.id,
    title: event.title,
    day:
      event.startsAt < tomorrow ? "today" : event.startsAt < afterTomorrow ? "tomorrow" : "later",
    time: clock.format(event.startsAt),
    duration: duration(event.startsAt, event.endsAt),
    date: weekday.format(event.startsAt),
    range: `${clock.format(event.startsAt)} – ${clock.format(event.endsAt)}`,
    location: event.locationName,
    priceCents: event.priceCents,
    color: event.color,
    remaining: event.capacity === null ? null : Math.max(0, event.capacity - event.seatsHeld),
    capacity: event.capacity,
    waitlist: event.waitlistEnabled,
  }));

  return (
    <>
      <PageHeader
        eyebrow="Réservations / Comptoir"
        title="Comptoir"
        subtitle="Une réservation prise au téléphone ou sur place, en trois gestes."
      />
      {counterEvents.length === 0 ? (
        <EmptyState
          title="Aucune séance ouverte."
          description="Publie d'abord un événement à venir : il apparaîtra ici pour y inscrire quelqu'un."
          actions={
            <ButtonLink href="/app/evenements" arrow>
              Voir mes événements
            </ButtonLink>
          }
        />
      ) : (
        <CounterWizard
          events={counterEvents}
          initialEventId={param(query.evenement)}
          initialCustomer={
            customer
              ? {
                  id: customer.customer.id,
                  name: `${customer.customer.firstName} ${customer.customer.lastName}`,
                  phone: customer.customer.phone,
                  email: customer.customer.email,
                  bookings: customer.customer.bookings,
                }
              : undefined
          }
        />
      )}
    </>
  );
}
