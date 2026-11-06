import { createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";

/*
 * Paramètres d'URL en texte simple (« ?places=2&q=pot »), comme un formulaire HTML et comme
 * l'ancienne app : le routeur les encode en JSON par défaut (« ?places=%222%22 »).
 */
function parseSearch(searchStr: string): Record<string, string> {
  return Object.fromEntries(new URLSearchParams(searchStr));
}

function stringifySearch(search: Record<string, unknown>): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(search)) {
    if (value !== undefined && value !== null && value !== "") params.set(key, String(value));
  }
  const query = params.toString();
  return query ? `?${query}` : "";
}

/** Un routeur par requête (serveur) ou par onglet (navigateur). */
export function getRouter() {
  return createRouter({
    routeTree,
    scrollRestoration: true,
    parseSearch,
    stringifySearch,
    // Données préchargées au survol d'un lien, gardées 30 s : la page suivante s'affiche aussitôt.
    defaultPreload: "intent",
    // Changement de page en transition de vue native (voir app.css : notch et capsule ancrés).
    defaultViewTransition: true,
  });
}
