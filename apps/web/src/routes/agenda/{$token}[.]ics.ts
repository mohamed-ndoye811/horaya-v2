import { createFileRoute } from "@tanstack/react-router";
import { calendarFeedResponse } from "@/server/calendar-feed";

/** Abonnement d'agenda personnel d'un membre (Google Agenda, Apple Calendrier, Outlook). */
export const Route = createFileRoute("/agenda/{$token}.ics")({
  server: {
    handlers: {
      GET: ({ params }) => calendarFeedResponse(params.token),
    },
  },
});
