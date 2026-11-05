import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AuthLead, AuthShell, AuthTitle, BrandAside } from "@/components/auth/auth-shell";
import { listMyWorkspaces, requireSession } from "@/server/auth";
import { PaymentLinkForm } from "./payment-link-form";

export const metadata: Metadata = { title: "Paiements · Horaya" };

/** Étape 3 (maquette 4.4) : lien de paiement, facultatif. */
export default async function PaymentsStepPage() {
  await requireSession();
  if ((await listMyWorkspaces()).length === 0) redirect("/inscription/espace");

  return (
    <AuthShell
      step={3}
      aside={
        <BrandAside
          title={
            <>
              Tes clients paient
              <br />
              en un clic.
            </>
          }
          lead="Un bouton « Payer » dans chaque confirmation, vers ton propre lien de paiement. L'argent arrive directement chez toi."
        />
      }
      footnote={
        <>
          Tu pourras changer ton lien dans Paramètres → Paiements. Besoin d'aide ?{" "}
          <a href="mailto:bonjour@horaya.app" className="text-ink underline underline-offset-2">
            Nous écrire
          </a>
        </>
      }
      width="lg"
    >
      <div className="flex flex-col gap-2">
        <AuthTitle size="md">Paiements.</AuthTitle>
        <AuthLead>
          Colle ton lien de paiement : on l'ajoute aux confirmations de réservation.
        </AuthLead>
      </div>
      <PaymentLinkForm />
    </AuthShell>
  );
}
