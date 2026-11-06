import { createFileRoute } from "@tanstack/react-router";
import { auth } from "@/server/auth";

/** Better Auth : connexion, session, organisations… (le client passe par /api/auth). */
export const Route = createFileRoute("/api/auth/$")({
  server: {
    handlers: {
      GET: ({ request }) => auth.handler(request),
      POST: ({ request }) => auth.handler(request),
    },
  },
});
