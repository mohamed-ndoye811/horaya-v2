import { createFileRoute } from "@tanstack/react-router";
import { BookingsPage } from "@/features/reservations/bookings-page";
import { bookingsSearch, getBookings } from "@/functions/bookings";

export const Route = createFileRoute("/app/reservations/")({
  validateSearch: bookingsSearch,
  loaderDeps: ({ search }) => search,
  loader: ({ deps }) => getBookings({ data: deps }),
  head: () => ({ meta: [{ title: "Réservations · Horaya" }] }),
  component: Bookings,
});

function Bookings() {
  return <BookingsPage data={Route.useLoaderData()} filters={Route.useSearch()} />;
}
