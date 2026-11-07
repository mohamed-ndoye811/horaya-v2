/**
 * Signale une erreur du navigateur au serveur (/api/erreurs), qui la relaie au suivi des
 * erreurs. Dix rapports par page au plus, sans doublon.
 */
const seen = new Set<string>();

export function reportClientError(error: unknown): void {
  if (typeof window === "undefined" || seen.size >= 10) return;
  const message = error instanceof Error ? error.message : String(error);
  if (seen.has(message)) return;
  seen.add(message);
  const body = JSON.stringify({
    message: message.slice(0, 1000),
    stack: error instanceof Error ? error.stack?.slice(0, 8000) : undefined,
    url: window.location.href.slice(0, 500),
  });
  // sendBeacon survit à un changement de page ; fetch en secours.
  if (!navigator.sendBeacon?.("/api/erreurs", new Blob([body], { type: "application/json" }))) {
    fetch("/api/erreurs", { method: "POST", body, keepalive: true }).catch(() => undefined);
  }
}

/** Erreurs hors React (scripts, promesses rejetées) : à brancher une fois au démarrage. */
export function watchClientErrors(): void {
  if (typeof window === "undefined") return;
  window.addEventListener("error", (event) => reportClientError(event.error ?? event.message));
  window.addEventListener("unhandledrejection", (event) => reportClientError(event.reason));
}
