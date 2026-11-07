import { createFileRoute, getRouteApi } from "@tanstack/react-router";
import { CustomerHomePage } from "@/features/customer-space/home-page";
import { getCustomerHome } from "@/functions/customer-space";

const layout = getRouteApi("/$slug");

/** Maquettes 8.2 et 8.6 : accueil de l'espace client chez un atelier. */
export const Route = createFileRoute("/$slug/mon-espace/")({
  loader: ({ params }) => getCustomerHome({ data: params.slug }),
  head: () => ({ meta: [{ title: "Mon espace" }, { name: "robots", content: "noindex" }] }),
  component: CustomerHome,
});

function CustomerHome() {
  // Lots 30 à 32 : passer ici `slots` (trimestre, carte de séances, bons cadeaux) quand le
  // loader en renvoie les données.
  return <CustomerHomePage workspace={layout.useLoaderData()} data={Route.useLoaderData()} />;
}
