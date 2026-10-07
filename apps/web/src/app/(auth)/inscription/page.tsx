import type { Metadata } from "next";
import { AuthShell } from "@/components/auth/auth-shell";
import { googleEnabled } from "@/server/env";
import { invitationContext } from "@/server/invitation";
import { redirectIfSignedIn } from "../redirect-if-signed-in";
import { SignupForm } from "./signup-form";

export const metadata: Metadata = { title: "Créer ton compte · Horaya" };

export default async function SignupPage({ searchParams }: PageProps<"/inscription">) {
  const invitation = await invitationContext((await searchParams).invitation);
  await redirectIfSignedIn(invitation ? `/invitation/${invitation.id}` : undefined);

  return (
    <AuthShell
      topLink={{
        prompt: "Déjà un compte ?",
        label: "Se connecter",
        href: invitation ? `/connexion?invitation=${invitation.id}` : "/connexion",
      }}
      footnote="14 jours d'essai gratuit · Sans carte bancaire · Résiliable à tout moment."
    >
      <SignupForm googleEnabled={googleEnabled} invitation={invitation ?? undefined} />
    </AuthShell>
  );
}
