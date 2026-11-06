import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/app/page-header";
import { CustomerForm } from "@/features/clients/customer-form";
import { getCustomerForEdit } from "@/functions/clients";

export const Route = createFileRoute("/app/clients/$id/modifier")({
  loader: ({ params }) => getCustomerForEdit({ data: params.id }),
  head: () => ({ meta: [{ title: "Modifier le client · Horaya" }] }),
  component: EditCustomerPage,
});

function EditCustomerPage() {
  const { id } = Route.useParams();
  const customer = Route.useLoaderData();
  return (
    <>
      <PageHeader
        eyebrow={`Clients / ${customer.firstName} ${customer.lastName} / Modifier`}
        title="Modifier"
      />
      <CustomerForm customerId={id} initial={customer} />
    </>
  );
}
