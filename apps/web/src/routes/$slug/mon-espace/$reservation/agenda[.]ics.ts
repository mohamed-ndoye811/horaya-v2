import { createFileRoute } from "@tanstack/react-router";
import { customerBookingIcs } from "@/server/customer-space";

/** Fichier .ics d'une réservation de l'espace client (Apple Calendrier, Outlook). */
export const Route = createFileRoute("/$slug/mon-espace/$reservation/agenda.ics")({
  server: {
    handlers: {
      GET: ({ params }) => customerBookingIcs(params.slug, params.reservation),
    },
  },
});
