import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { CustomerLoginPage } from "@/features/customer-space/login-page";
import { getCustomerLoginPage } from "@/functions/customer-space";
import { searchText } from "@/lib/search-params";

/** Connexion à la vue horaya.app (maquette 8.1, aux couleurs d'Horaya). */
export const Route = createFileRoute("/mon-espace/connexion")({
  validateSearch: z.object({ email: searchText, jeton: searchText }),
  loaderDeps: ({ search }) => ({ jeton: search.jeton }),
  loader: ({ deps }) => getCustomerLoginPage({ data: { slug: null, token: deps.jeton } }),
  head: () => ({
    meta: [{ title: "Mes réservations · Horaya" }, { name: "robots", content: "noindex" }],
  }),
  component: NeutralLogin,
});

function NeutralLogin() {
  const { email, jeton } = Route.useSearch();
  return (
    <CustomerLoginPage
      slug={null}
      workspaceName={null}
      displayFont={null}
      email={email ?? ""}
      token={jeton}
      minutes={Route.useLoaderData().linkMinutes}
    />
  );
}
