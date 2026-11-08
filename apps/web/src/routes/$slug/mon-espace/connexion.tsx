import { createFileRoute, getRouteApi } from "@tanstack/react-router";
import { z } from "zod";
import { CustomerLoginPage } from "@/features/customer-space/login-page";
import { getCustomerLoginPage } from "@/functions/customer-space";
import { searchText } from "@/lib/search-params";

const layout = getRouteApi("/$slug");

/** Maquette 8.1 : connexion par lien magique (?jeton=… : arrivée par le lien de l'e-mail). */
export const Route = createFileRoute("/$slug/mon-espace/connexion")({
  validateSearch: z.object({ email: searchText, jeton: searchText }),
  loaderDeps: ({ search }) => ({ jeton: search.jeton }),
  loader: ({ params, deps }) =>
    getCustomerLoginPage({ data: { slug: params.slug, token: deps.jeton } }),
  head: () => ({ meta: [{ title: "Mon espace" }, { name: "robots", content: "noindex" }] }),
  component: CustomerLogin,
});

function CustomerLogin() {
  const workspace = layout.useLoaderData();
  const { email, jeton } = Route.useSearch();
  return (
    <CustomerLoginPage
      slug={workspace.slug}
      workspaceName={workspace.name}
      displayFont={workspace.displayFont}
      image={workspace.coverImageUrl}
      email={email ?? ""}
      token={jeton}
      minutes={Route.useLoaderData().linkMinutes}
    />
  );
}
