import { addDays } from "@horaya/core";
import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { PageHeader } from "@/components/app/page-header";
import { RentalForm } from "@/features/inventory/rental-form";
import { getItemRental } from "@/functions/inventory";
import { civilKey } from "@/lib/calendar";

export const Route = createFileRoute("/app/materiel/$id/louer")({
  validateSearch: z.object({ client: z.string().uuid().optional().catch(undefined) }),
  loaderDeps: ({ search }) => search,
  loader: ({ params, deps }) => getItemRental({ data: { id: params.id, client: deps.client } }),
  head: () => ({ meta: [{ title: "Louer · Horaya" }] }),
  component: RentItemPage,
});

function RentItemPage() {
  const { id } = Route.useParams();
  const { item, tomorrow, customer } = Route.useLoaderData();
  return (
    <>
      <PageHeader
        eyebrow={`Matériel / Réf. ${item.reference} / Louer`}
        title="Louer"
        subtitle={
          <>
            {item.name}. <span className="text-ink">Location seule, hors événement.</span>
          </>
        }
      />
      <RentalForm
        itemId={id}
        name={item.name}
        reference={item.reference}
        units={item.units}
        dailyRateCents={item.dailyRateCents}
        depositCents={item.depositCents}
        defaults={{ startDate: civilKey(tomorrow), endDate: civilKey(addDays(tomorrow, 1)) }}
        customer={customer}
      />
    </>
  );
}
