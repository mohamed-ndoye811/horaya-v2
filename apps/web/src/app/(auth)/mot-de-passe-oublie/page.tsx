import type { Metadata } from "next";
import { AuthShell } from "@/components/auth/auth-shell";
import { ForgotPasswordForm } from "./forgot-password-form";

export const metadata: Metadata = { title: "Mot de passe oublié · Horaya" };

export default function ForgotPasswordPage() {
  return (
    <AuthShell
      topLink={{ prompt: "Pas encore de compte ?", label: "Créer un espace", href: "/inscription" }}
      footnote="Tu n'as plus accès à cet e-mail ? Écris-nous à bonjour@horaya.app."
    >
      <ForgotPasswordForm />
    </AuthShell>
  );
}
