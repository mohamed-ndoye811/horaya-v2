import { createFileRoute } from "@tanstack/react-router";
import { CustomerDetailPage } from "@/features/clients/customer-detail-page";
import { getCustomer } from "@/functions/clients";

export const Route = createFileRoute("/app/clients/$id/")({
  loader: ({ params }) => getCustomer({ data: params.id }),
  head: () => ({ meta: [{ title: "Fiche client · Horaya" }] }),
  component: () => <CustomerDetailPage data={Route.useLoaderData()} />,
});
