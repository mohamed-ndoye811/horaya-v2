import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/app/page-header";
import { ItemForm } from "@/features/inventory/item-form";
import { getItemForEdit } from "@/functions/inventory";
import { centsToInput } from "@/lib/money";

export const Route = createFileRoute("/app/materiel/$id/modifier")({
  loader: ({ params }) => getItemForEdit({ data: params.id }),
  head: () => ({ meta: [{ title: "Modifier l'article · Horaya" }] }),
  component: EditItemPage,
});

function EditItemPage() {
  const { id } = Route.useParams();
  const { item, types } = Route.useLoaderData();
  const cents = (value: number | null) => (value === null ? "" : centsToInput(value));
  return (
    <>
      <PageHeader eyebrow={`Matériel / ${item.reference} / Modifier`} title="Modifier" />
      <ItemForm
        itemId={id}
        types={types}
        initial={{
          name: item.name,
          reference: item.reference,
          typeName: item.typeName ?? "",
          quantity: String(item.units),
          description: item.description ?? "",
          dailyRate: cents(item.dailyRateCents),
          deposit: cents(item.depositCents),
          storageLocation: item.storageLocation ?? "",
          purchasedOn: item.purchasedOn ?? "",
          purchasePrice: cents(item.purchasePriceCents),
          rentable: item.rentable,
        }}
        fieldValues={item.fieldValues}
      />
    </>
  );
}
