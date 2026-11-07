import { createRouter } from "@tanstack/react-router";
import { reportClientError, watchClientErrors } from "./lib/report-error";
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

/** Sous-menus qui gardent la même coque (titre, menu) : seul leur contenu change. */
const SECTIONS = ["/app/parametres/"];
const sameSection = (from: string, to: string) =>
  SECTIONS.some((prefix) => from.startsWith(prefix) && to.startsWith(prefix));

let watching = false;

/** Un routeur par requête (serveur) ou par onglet (navigateur). */
export function getRouter() {
  if (typeof window !== "undefined" && !watching) {
    watching = true;
    watchClientErrors();
  }
  return createRouter({
    // Erreur d'affichage d'un écran (attrapée par le routeur) : signalée au suivi des erreurs.
    defaultOnCatch: (error) => reportClientError(error),
    routeTree,
    scrollRestoration: true,
    parseSearch,
    stringifySearch,
    // Données préchargées au survol d'un lien, gardées 30 s : la page suivante s'affiche aussitôt.
    defaultPreload: "intent",
    /*
     * Transitions de vue seulement quand ça a du sens (voir app.css) : « page » pour un autre
     * écran, « section » pour un autre onglet d'un sous-menu (seul son contenu change), rien pour
     * un filtre, une recherche ou un onglet en paramètre d'URL (le contenu se met à jour sur place).
     */
    defaultViewTransition: {
      types: ({ fromLocation, toLocation, pathChanged }) => {
        if (!fromLocation || !pathChanged) return false;
        return [sameSection(fromLocation.pathname, toLocation.pathname) ? "section" : "page"];
      },
    },
    // La page défile dans le cadre (pas la fenêtre) : on remonte ce conteneur à chaque écran.
    scrollToTopSelectors: ["[data-scroll-zone]"],
  });
}
