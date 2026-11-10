import { createFileRoute } from "@tanstack/react-router";
import { HelpPage } from "@/features/legal/help-page";

export const Route = createFileRoute("/aide")({
  head: () => ({
    meta: [
      { title: "Aide · Horaya" },
      {
        name: "description",
        content:
          "Démarrer, publier un événement, suivre les réservations, cartes, bons cadeaux, matériel : les gestes d'Horaya en quelques étapes.",
      },
    ],
  }),
  component: HelpPage,
});
