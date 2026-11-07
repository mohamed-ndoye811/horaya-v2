import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/app/page-header";
import { SellGiftCardForm } from "@/features/gift-cards/sell-form";

export const Route = createFileRoute("/app/bons-cadeaux/nouveau")({
  head: () => ({ meta: [{ title: "Vendre un bon cadeau · Horaya" }] }),
  component: () => (
    <>
      <PageHeader
        eyebrow="Bons cadeaux / Nouveau"
        title="Vendre un bon"
        subtitle="Vente au comptoir : le bon est actif dès que tu notes l'encaissement."
      />
      <SellGiftCardForm />
    </>
  ),
});
