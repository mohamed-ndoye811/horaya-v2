import { createFileRoute, redirect } from "@tanstack/react-router";
import { z } from "zod";
import { searchText } from "@/lib/search-params";

/** Ancienne page « Mes réservations » (liens par e-mail) : remplacée par l'espace client. */
export const Route = createFileRoute("/$slug/mes-reservations")({
  validateSearch: z.object({ email: searchText }),
  beforeLoad: ({ params, search }) => {
    throw redirect({
      to: "/$slug/mon-espace/connexion",
      params: { slug: params.slug },
      search: { email: search.email },
    });
  },
});
