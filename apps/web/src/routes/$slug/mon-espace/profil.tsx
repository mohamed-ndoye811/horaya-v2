import { createFileRoute, getRouteApi } from "@tanstack/react-router";
import { CustomerProfilePage } from "@/features/customer-space/profile-page";
import { getCustomerProfilePage } from "@/functions/customer-space";

const layout = getRouteApi("/$slug");

/** Maquette 8.4 : profil de l'espace client. */
export const Route = createFileRoute("/$slug/mon-espace/profil")({
  loader: ({ params }) => getCustomerProfilePage({ data: { slug: params.slug } }),
  head: () => ({ meta: [{ title: "Mon profil" }, { name: "robots", content: "noindex" }] }),
  component: CustomerProfile,
});

function CustomerProfile() {
  const workspace = layout.useLoaderData();
  return (
    <CustomerProfilePage
      slug={workspace.slug}
      workspaceName={workspace.name}
      displayFont={workspace.displayFont}
      image={workspace.coverImageUrl}
      account={Route.useLoaderData().account}
    />
  );
}
