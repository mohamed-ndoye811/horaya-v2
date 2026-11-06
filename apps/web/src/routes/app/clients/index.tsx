import { createFileRoute } from "@tanstack/react-router";
import { CustomersPage } from "@/features/clients/customers-page";
import { customersSearch, getCustomers } from "@/functions/clients";

export const Route = createFileRoute("/app/clients/")({
  validateSearch: customersSearch,
  loaderDeps: ({ search }) => search,
  loader: ({ deps }) => getCustomers({ data: deps }),
  head: () => ({ meta: [{ title: "Clients · Horaya" }] }),
  component: Customers,
});

function Customers() {
  return <CustomersPage data={Route.useLoaderData()} filters={Route.useSearch()} />;
}
