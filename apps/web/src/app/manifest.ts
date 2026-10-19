import type { MetadataRoute } from "next";

/** Ajout à l'écran d'accueil (Android) ; iOS lit apple-icon.png. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Horaya",
    short_name: "Horaya",
    description: "Réservations, événements et matériel dans un seul agenda, sous ta marque.",
    start_url: "/app",
    display: "standalone",
    background_color: "#F2F0EF",
    theme_color: "#264489",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
  };
}
