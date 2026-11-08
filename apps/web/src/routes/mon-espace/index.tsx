import { createFileRoute } from "@tanstack/react-router";
import { AllBookingsPage } from "@/features/customer-space/all-bookings-page";
import { getAllCustomerBookings } from "@/functions/customer-space";

/** Maquette 8.5 : toutes mes réservations, tous ateliers confondus. */
export const Route = createFileRoute("/mon-espace/")({
  loader: () => getAllCustomerBookings(),
  head: () => ({
    meta: [{ title: "Toutes mes réservations · Horaya" }, { name: "robots", content: "noindex" }],
  }),
  component: () => <AllBookingsPage data={Route.useLoaderData()} />,
});
