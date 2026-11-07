import { createFileRoute, getRouteApi } from "@tanstack/react-router";
import { z } from "zod";
import { CustomerBookingPage } from "@/features/customer-space/booking-page";
import { getCustomerBookingPage } from "@/functions/customer-space";
import { searchText } from "@/lib/search-params";

const layout = getRouteApi("/$slug");

/** Maquette 8.3 : une réservation de l'espace client. */
export const Route = createFileRoute("/$slug/mon-espace/$reservation/")({
  validateSearch: z.object({ paiement: searchText }),
  loader: ({ params }) =>
    getCustomerBookingPage({ data: { slug: params.slug, booking: params.reservation } }),
  head: ({ loaderData }) => ({
    meta: [
      { title: loaderData?.booking.eventTitle ?? "Ma réservation" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: CustomerBooking,
});

function CustomerBooking() {
  return (
    <CustomerBookingPage
      workspace={layout.useLoaderData()}
      data={Route.useLoaderData()}
      paymentReturn={Route.useSearch().paiement}
    />
  );
}
