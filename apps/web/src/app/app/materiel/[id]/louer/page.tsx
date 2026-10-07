import { addDays } from "@horaya/core";
import { getCustomerDetail, getItemDetail } from "@horaya/db";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/app/page-header";
import { civilKey } from "@/lib/calendar";
import { todayIn } from "@/lib/dates";
import { param } from "@/lib/search-params";
import { db } from "@/server/db";
import { getWorkspaceContext } from "@/server/workspace";
import { RentalForm } from "./rental-form";

export const metadata: Metadata = { title: "Louer · Horaya" };

export default async function RentItemPage({
  params,
  searchParams,
}: PageProps<"/app/materiel/[id]/louer">) {
  const { id } = await params;
  const query = await searchParams;
  const { workspace, timeZone } = await getWorkspaceContext();
  const now = new Date();
  const [detail, customer] = await Promise.all([
    getItemDetail(db, workspace.id, id, { from: now, to: now, now }),
    param(query.client)
      ? getCustomerDetail(db, workspace.id, param(query.client) ?? "", now)
      : null,
  ]);
  if (!detail || detail.item.archivedAt) notFound();
  const { item } = detail;
  const tomorrow = addDays(todayIn(timeZone, now), 1);

  return (
    <>
      <PageHeader
        eyebrow={`Matériel / Réf. ${item.reference} / Louer`}
        title="Louer"
        subtitle={`${item.name} · location seule, hors événement.`}
      />
      <RentalForm
        itemId={id}
        units={item.units}
        dailyRateCents={item.dailyRateCents}
        depositCents={item.depositCents}
        defaults={{ startDate: civilKey(tomorrow), endDate: civilKey(addDays(tomorrow, 1)) }}
        customer={customer?.customer}
      />
    </>
  );
}
