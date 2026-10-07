import type { Metadata } from "next";
import { AuthShell } from "@/components/auth/auth-shell";
import { googleEnabled } from "@/server/env";
import { redirectIfSignedIn } from "../redirect-if-signed-in";
import { SignupForm } from "./signup-form";

export const metadata: Metadata = { title: "Créer ton compte · Horaya" };

export default async function SignupPage() {
  await redirectIfSignedIn();

  return (
    <AuthShell
      topLink={{ prompt: "Déjà un compte ?", label: "Se connecter", href: "/connexion" }}
      footnote="14 jours d'essai gratuit · Sans carte bancaire · Résiliable à tout moment."
    >
      <SignupForm googleEnabled={googleEnabled} />
    </AuthShell>
  );
}
