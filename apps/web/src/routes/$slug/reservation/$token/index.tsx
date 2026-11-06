import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { ManagedBookingPage } from "@/features/public/managed-booking-page";
import { getManagedBookingPage } from "@/functions/public";
import { searchText } from "@/lib/search-params";

/** Maquette 5.4 : juste après la réservation (?nouvelle=1) et « Gérer ma réservation ». */
export const Route = createFileRoute("/$slug/reservation/$token/")({
  validateSearch: z.object({ nouvelle: searchText, paiement: searchText }),
  loader: ({ params }) => getManagedBookingPage({ data: params }),
  head: () => ({ meta: [{ title: "Ta réservation" }, { name: "robots", content: "noindex" }] }),
  component: ManagedBooking,
});

function ManagedBooking() {
  return (
    <ManagedBookingPage
      token={Route.useParams().token}
      search={Route.useSearch()}
      data={Route.useLoaderData()}
    />
  );
}
