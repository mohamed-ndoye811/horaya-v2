import { getItemDetail, listItemTypeNames } from "@horaya/db";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/app/page-header";
import { centsToInput } from "@/lib/money";
import { db } from "@/server/db";
import { getWorkspaceContext } from "@/server/workspace";
import { ItemForm } from "../../item-form";

export const metadata: Metadata = { title: "Modifier l'article · Horaya" };

export default async function EditItemPage({ params }: PageProps<"/app/materiel/[id]/modifier">) {
  const { id } = await params;
  const { workspace } = await getWorkspaceContext();
  const now = new Date();
  const [detail, types] = await Promise.all([
    getItemDetail(db, workspace.id, id, { from: now, to: now, now }),
    listItemTypeNames(db, workspace.id),
  ]);
  if (!detail || detail.item.archivedAt) notFound();
  const { item } = detail;
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
      />
    </>
  );
}
