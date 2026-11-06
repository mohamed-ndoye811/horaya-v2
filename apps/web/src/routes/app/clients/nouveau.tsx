import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/app/page-header";
import { CustomerForm } from "@/features/clients/customer-form";

export const Route = createFileRoute("/app/clients/nouveau")({
  head: () => ({ meta: [{ title: "Nouveau client · Horaya" }] }),
  component: NewCustomerPage,
});

/** Ajout d'un client (la coque /app vérifie déjà la session). */
function NewCustomerPage() {
  return (
    <>
      <PageHeader
        eyebrow="Clients / Nouveau"
        title="Nouveau client"
        subtitle={
          <>
            Les clients sont aussi créés automatiquement{" "}
            <span className="text-ink">à leur première réservation.</span>
          </>
        }
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
