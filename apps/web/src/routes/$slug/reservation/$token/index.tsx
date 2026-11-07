import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { ManagedEnrollmentPage } from "@/features/enrollments/managed-enrollment-page";
import { ManagedBookingPage } from "@/features/public/managed-booking-page";
import { getManagedBookingPage } from "@/functions/public";
import { searchText } from "@/lib/search-params";

/**
 * Maquette 5.4 : juste après la réservation (?nouvelle=1) et « Gérer ma réservation ». Le même
 * lien sert à gérer une inscription à une série (cours à l'année).
 */
export const Route = createFileRoute("/$slug/reservation/$token/")({
  validateSearch: z.object({ nouvelle: searchText, paiement: searchText }),
  loader: ({ params }) => getManagedBookingPage({ data: params }),
  head: () => ({ meta: [{ title: "Ta réservation" }, { name: "robots", content: "noindex" }] }),
  component: ManagedBooking,
});

function ManagedBooking() {
  const data = Route.useLoaderData();
  const search = Route.useSearch();
  const { token } = Route.useParams();
  if (data.enrollment) {
    return (
      <ManagedEnrollmentPage
        workspace={data.workspace}
        enrollment={data.enrollment}
        token={token}
        fresh={search.nouvelle === "1"}
        now={data.now}
      />
    );
  }
  return <ManagedBookingPage token={token} search={search} data={data} />;
}
