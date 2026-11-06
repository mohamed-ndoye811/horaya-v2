import { createFileRoute } from "@tanstack/react-router";
import { AuthShell } from "@/components/auth/auth-shell";
import { ForgotPasswordForm } from "@/features/auth/forgot-password-form";

export const Route = createFileRoute("/(auth)/mot-de-passe-oublie")({
  head: () => ({ meta: [{ title: "Mot de passe oublié · Horaya" }] }),
  component: ForgotPasswordPage,
});

function ForgotPasswordPage() {
  return (
    <AuthShell
      topLink={{ prompt: "Pas encore de compte ?", label: "Créer un espace", href: "/inscription" }}
      footnote="Tu n'as plus accès à cet e-mail ? Écris-nous à bonjour@horaya.app."
    >
      <ForgotPasswordForm />
    </AuthShell>
  );
}
