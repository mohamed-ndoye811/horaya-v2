import { createFileRoute } from "@tanstack/react-router";
import { CustomerProfilePage } from "@/features/customer-space/profile-page";
import { getCustomerProfilePage } from "@/functions/customer-space";

/** Profil depuis la vue horaya.app (même formulaire que la maquette 8.4). */
export const Route = createFileRoute("/mon-espace/profil")({
  loader: () => getCustomerProfilePage({ data: { slug: null } }),
  head: () => ({
    meta: [{ title: "Mon profil · Horaya" }, { name: "robots", content: "noindex" }],
  }),
  component: () => (
    <CustomerProfilePage
      slug={null}
      workspaceName={null}
      displayFont={null}
      account={Route.useLoaderData().account}
    />
  ),
});
