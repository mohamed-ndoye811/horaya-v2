import { createFileRoute } from "@tanstack/react-router";
import { auth } from "@/server/auth";

/**
 * Better Auth : connexion, session, organisations… (le client passe par /api/auth). Les routes
 * du module admin restent fermées : le cockpit les appelle côté serveur, après ses vérifications.
 */
const handle = (request: Request) =>
  new URL(request.url).pathname.startsWith("/api/auth/admin/")
    ? new Response("Introuvable", { status: 404 })
    : auth.handler(request);

export const Route = createFileRoute("/api/auth/$")({
  server: {
    handlers: {
      GET: ({ request }) => handle(request),
      POST: ({ request }) => handle(request),
    },
  },
});
