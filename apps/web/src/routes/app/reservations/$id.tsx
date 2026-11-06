import { createFileRoute } from "@tanstack/react-router";
import { BookingDetailPage } from "@/features/reservations/booking-detail-page";
import { getBooking } from "@/functions/booking";

export const Route = createFileRoute("/app/reservations/$id")({
  loader: ({ params }) => getBooking({ data: params.id }),
  head: () => ({ meta: [{ title: "Réservation · Horaya" }] }),
  component: () => <BookingDetailPage data={Route.useLoaderData()} />,
});
