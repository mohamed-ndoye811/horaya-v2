import { listItemTypeNames } from "@horaya/db";
import type { Metadata } from "next";
import { PageHeader } from "@/components/app/page-header";
import { db } from "@/server/db";
import { getWorkspaceContext } from "@/server/workspace";
import { ItemForm } from "../item-form";

export const metadata: Metadata = { title: "Nouvel article · Horaya" };

export default async function NewItemPage() {
  const { workspace } = await getWorkspaceContext();
  const types = await listItemTypeNames(db, workspace.id);
  return (
    <>
      <PageHeader
        eyebrow="Matériel / Nouveau"
        title="Nouvel article"
        subtitle="Chaque exemplaire (#1, #2…) est suivi séparément : jamais deux réservations sur le même au même moment."
      />
      <ItemForm
        itemId={null}
        types={types}
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
