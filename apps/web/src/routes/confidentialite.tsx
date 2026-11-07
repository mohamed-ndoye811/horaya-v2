import { createFileRoute } from "@tanstack/react-router";
import { PrivacyPage } from "@/features/legal/privacy-page";

export const Route = createFileRoute("/confidentialite")({
  head: () => ({
    meta: [
      { title: "Politique de confidentialité · Horaya" },
      {
        name: "description",
        content: "Les données traitées par Horaya, pourquoi, où elles sont stockées et tes droits.",
      },
    ],
  }),
  component: PrivacyPage,
});
