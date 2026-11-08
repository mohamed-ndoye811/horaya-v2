import { createFileRoute } from "@tanstack/react-router";
import { customerFeedResponse } from "@/server/customer-space";

/** Agenda personnel d'un client (?espace=<adresse> : seulement cet atelier). */
export const Route = createFileRoute("/agenda/client/{$token}.ics")({
  server: {
    handlers: {
      GET: ({ params, request }) =>
        customerFeedResponse(params.token, new URL(request.url).searchParams.get("espace")),
    },
  },
});
