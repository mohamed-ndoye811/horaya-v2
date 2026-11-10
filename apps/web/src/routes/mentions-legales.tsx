import { createFileRoute } from "@tanstack/react-router";
import { LegalNoticePage } from "@/features/legal/legal-notice-page";

export const Route = createFileRoute("/mentions-legales")({
  head: () => ({
    meta: [
      { title: "Mentions légales · Horaya" },
      { name: "description", content: "Éditeur et hébergeur de horaya.app." },
    ],
  }),
  component: LegalNoticePage,
});
