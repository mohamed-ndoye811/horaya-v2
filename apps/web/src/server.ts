import handler, { createServerEntry } from "@tanstack/react-start/server-entry";
import { scheduleReminders } from "./server/reminders";

// Tâches de fond (rappels de la veille) : en production seulement, jamais sur un poste local.
if (process.env.NODE_ENV === "production" && !process.env.POSTE) scheduleReminders();

/** En-têtes de sécurité de toutes les réponses (HSTS et TLS sont gérés par Cloudflare et l'ingress). */
const SECURITY_HEADERS: Record<string, string> = {
  "X-Content-Type-Options": "nosniff",
  // En local, l'app peut s'afficher dans un cadre de la même origine (aperçu mobile à 390 px).
  "X-Frame-Options": process.env.NODE_ENV === "production" ? "DENY" : "SAMEORIGIN",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=(), payment=()",
};

/** Point d'entrée du serveur : le gestionnaire de TanStack Start, plus les en-têtes ci-dessus. */
export default createServerEntry({
  async fetch(request, options) {
    const response = await handler.fetch(request, options);
    // Copie : les en-têtes d'une redirection sont figés.
    const headers = new Headers(response.headers);
    for (const [name, value] of Object.entries(SECURITY_HEADERS)) headers.set(name, value);
    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers,
    });
  },
});
