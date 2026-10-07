import type { Metadata } from "next";
import { AuthShell } from "@/components/auth/auth-shell";
import { googleEnabled } from "@/server/env";
import { redirectIfSignedIn } from "../redirect-if-signed-in";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Connexion · Horaya" };

export default async function LoginPage() {
  await redirectIfSignedIn();

  return (
    <AuthShell
      topLink={{ prompt: "Pas encore de compte ?", label: "Créer un espace", href: "/inscription" }}
      footnote="En continuant, tu acceptes les conditions d'utilisation et la politique de confidentialité."
    >
      <LoginForm googleEnabled={googleEnabled} />
    </AuthShell>
  );
}
