import { getCustomerDetail } from "@horaya/db";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/app/page-header";
import { db } from "@/server/db";
import { getWorkspaceContext } from "@/server/workspace";
import { CustomerForm } from "../../customer-form";

export const metadata: Metadata = { title: "Modifier le client · Horaya" };

export default async function EditCustomerPage({
  params,
}: PageProps<"/app/clients/[id]/modifier">) {
  const { id } = await params;
  const { workspace } = await getWorkspaceContext();
  const detail = await getCustomerDetail(db, workspace.id, id, new Date());
  if (!detail || detail.customer.anonymizedAt) notFound();
  const { customer } = detail;
  return (
    <>
      <PageHeader
        eyebrow={`Clients / ${customer.firstName} ${customer.lastName} / Modifier`}
        title="Modifier"
      />
      <CustomerForm
        customerId={id}
        initial={{
          firstName: customer.firstName,
          lastName: customer.lastName,
          email: customer.email,
          phone: customer.phone ?? "",
          company: customer.company ?? "",
          tags: customer.tags.join(", "),
          marketingConsent: customer.marketingConsent,
        }}
      />
    </>
  );
}
