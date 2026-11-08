import { createFileRoute } from "@tanstack/react-router";
import { PassesPage } from "@/features/passes/passes-page";
import { getPassesPage, passesSearch } from "@/functions/passes";

export const Route = createFileRoute("/app/cartes")({
  validateSearch: passesSearch,
  loaderDeps: ({ search }) => search,
  loader: () => getPassesPage(),
  head: () => ({ meta: [{ title: "Cartes de séances · Horaya" }] }),
  component: Passes,
});

function Passes() {
  return <PassesPage data={Route.useLoaderData()} selected={Route.useSearch().formule} />;
}
