import { createFileRoute } from "@tanstack/react-router";
import { InventoryPage } from "@/features/inventory/inventory-page";
import { getInventory, inventorySearch } from "@/functions/inventory";

export const Route = createFileRoute("/app/materiel/")({
  validateSearch: inventorySearch,
  loaderDeps: ({ search }) => search,
  loader: ({ deps }) => getInventory({ data: deps }),
  head: () => ({ meta: [{ title: "Matériel · Horaya" }] }),
  component: Inventory,
});

function Inventory() {
  return <InventoryPage data={Route.useLoaderData()} filters={Route.useSearch()} />;
}
