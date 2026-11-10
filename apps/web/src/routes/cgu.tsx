import { createFileRoute } from "@tanstack/react-router";
import { TermsPage } from "@/features/legal/terms-page";

export const Route = createFileRoute("/cgu")({
  head: () => ({
    meta: [
      { title: "Conditions d'utilisation · Horaya" },
      {
        name: "description",
        content:
          "Les règles d'utilisation d'Horaya : compte, formules, paiement, données et engagements.",
      },
    ],
  }),
  component: TermsPage,
});
