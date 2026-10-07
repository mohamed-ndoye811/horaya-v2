import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AuthLead, AuthShell, AuthTitle } from "@/components/auth/auth-shell";
import { OnboardingSteps } from "@/components/auth/onboarding-steps";
import { ButtonLink } from "@/components/ui/button";
import { FormAlert } from "@/components/ui/form-alert";
import { listMyWorkspaces, requireSession } from "@/server/auth";

export const metadata: Metadata = { title: "Paiements · Horaya" };

/** Étape 3 : le branchement Stripe arrive avec les pages publiques ; on peut passer. */
export default async function PaymentsStepPage() {
  await requireSession();
  if ((await listMyWorkspaces()).length === 0) redirect("/inscription/espace");

  return (
    <AuthShell
      topLink={{
        prompt: "Besoin d'aide ?",
        label: "Nous écrire",
        href: "mailto:bonjour@horaya.app",
      }}
      footnote="Tu pourras connecter Stripe à tout moment dans Paramètres → Paiements."
      width="lg"
    >
      <div className="flex flex-col gap-6">
        <OnboardingSteps current={3} />
        <AuthTitle size="md">Paiements</AuthTitle>
        <AuthLead>
          Encaisse acomptes et paiements en ligne, directement sur ton compte bancaire, via Stripe.
          Tes clients paient au moment de réserver ; tu suis tout depuis Horaya.
        </AuthLead>
        <FormAlert tone="info">
          Le paiement en ligne arrive très bientôt. En attendant, tes réservations fonctionnent avec
          un règlement sur place ou par virement.
        </FormAlert>
        <ButtonLink size="lg" href="/app" arrow className="w-full">
          Accéder à mon espace
        </ButtonLink>
      </div>
    </AuthShell>
  );
}
