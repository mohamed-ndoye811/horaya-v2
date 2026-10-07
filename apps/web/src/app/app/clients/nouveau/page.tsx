import type { Metadata } from "next";
import { PageHeader } from "@/components/app/page-header";
import { getWorkspaceContext } from "@/server/workspace";
import { CustomerForm } from "../customer-form";

export const metadata: Metadata = { title: "Nouveau client · Horaya" };

export default async function NewCustomerPage() {
  await getWorkspaceContext();
  return (
    <>
      <PageHeader
        eyebrow="Clients / Nouveau"
        title="Nouveau client"
        subtitle="Les clients sont aussi créés automatiquement à leur première réservation."
      />
      <CustomerForm
        customerId={null}
        initial={{
          firstName: "",
          lastName: "",
          email: "",
          phone: "",
          company: "",
          tags: "",
          marketingConsent: false,
        }}
      />
    </>
  );
}
