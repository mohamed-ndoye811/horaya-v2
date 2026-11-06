import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/app/page-header";
import { ItemForm } from "@/features/inventory/item-form";
import { getItemTypes } from "@/functions/inventory";

export const Route = createFileRoute("/app/materiel/nouveau")({
  loader: () => getItemTypes(),
  head: () => ({ meta: [{ title: "Nouvel article · Horaya" }] }),
  component: NewItemPage,
});

function NewItemPage() {
  return (
    <>
      <PageHeader
        eyebrow="Matériel / Nouveau"
        title="Nouvel article"
        subtitle={
          <>
            Chaque exemplaire (#1, #2…) est suivi séparément :{" "}
            <span className="text-ink">jamais deux réservations sur le même au même moment.</span>
          </>
        }
      />
      <ItemForm
        itemId={null}
        types={Route.useLoaderData()}
        initial={{
          name: "",
          reference: "",
          typeName: "",
          quantity: "1",
          description: "",
          dailyRate: "",
          deposit: "",
          storageLocation: "",
          purchasedOn: "",
          purchasePrice: "",
          rentable: false,
        }}
      />
    </>
  );
}
