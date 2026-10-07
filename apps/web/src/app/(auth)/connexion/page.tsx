import type { Metadata } from "next";
import { AuthShell } from "@/components/auth/auth-shell";
import { googleEnabled } from "@/server/env";
import { joinTarget } from "@/server/invitation";
import { redirectIfSignedIn } from "../redirect-if-signed-in";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Connexion · Horaya" };

export default async function LoginPage({ searchParams }: PageProps<"/connexion">) {
  const invitation = await joinTarget(await searchParams);
  await redirectIfSignedIn(invitation?.returnTo);

  return (
    <AuthShell
      topLink={
        invitation
          ? {
              prompt: "Pas encore de compte ?",
              label: "Créer mon compte",
              href: `/inscription?${invitation.query}`,
            }
          : { prompt: "Pas encore de compte ?", label: "Créer un espace", href: "/inscription" }
      }
      footnote="En continuant, tu acceptes les conditions d'utilisation et la politique de confidentialité."
    >
      <LoginForm googleEnabled={googleEnabled} invitation={invitation ?? undefined} />
    </AuthShell>
  );
}
