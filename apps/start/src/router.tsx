import { createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";

/** Un routeur par requête (serveur) ou par onglet (navigateur). */
export function getRouter() {
  return createRouter({
    routeTree,
    scrollRestoration: true,
    // Données préchargées au survol d'un lien, gardées 30 s : la page suivante s'affiche aussitôt.
    defaultPreload: "intent",
    // Changement de page en transition de vue native (voir app.css : notch et capsule ancrés).
    defaultViewTransition: true,
  });
}
