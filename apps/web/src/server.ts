import handler, { createServerEntry } from "@tanstack/react-start/server-entry";

/** En-têtes de sécurité de toutes les réponses (HSTS et TLS sont gérés par Cloudflare et l'ingress). */
const SECURITY_HEADERS: Record<string, string> = {
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
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
