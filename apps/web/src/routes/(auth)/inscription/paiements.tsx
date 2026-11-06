import { createFileRoute } from "@tanstack/react-router";
import { AuthLead, AuthShell, AuthTitle, BrandAside } from "@/components/auth/auth-shell";
import { PaymentLinkForm } from "@/features/auth/payment-link-form";
import { getOnboardingStep } from "@/functions/auth";

export const Route = createFileRoute("/(auth)/inscription/paiements")({
  loader: () => getOnboardingStep({ data: "paiements" }),
  head: () => ({ meta: [{ title: "Paiements · Horaya" }] }),
  component: PaymentsStepPage,
});

/** Étape 3 (maquette 4.4) : lien de paiement, facultatif. */
function PaymentsStepPage() {
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
