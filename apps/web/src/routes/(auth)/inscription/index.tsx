import { createFileRoute } from "@tanstack/react-router";
import { AuthShell } from "@/components/auth/auth-shell";
import { SignupForm } from "@/features/auth/signup-form";
import { authSearch, getAuthPage } from "@/functions/auth";

export const Route = createFileRoute("/(auth)/inscription/")({
  validateSearch: authSearch,
  loaderDeps: ({ search }) => search,
  loader: ({ deps }) => getAuthPage({ data: deps }),
  head: () => ({ meta: [{ title: "Créer ton compte · Horaya" }] }),
  component: SignupPage,
});

function SignupPage() {
  const { googleEnabled, invitation } = Route.useLoaderData();
  return (
    <AuthShell
      step={invitation ? undefined : 1}
      topLink={{
        prompt: "Déjà un compte ?",
        label: "Se connecter",
        href: invitation ? `/connexion?${invitation.query}` : "/connexion",
      }}
      footnote="14 jours d'essai gratuit · Sans carte bancaire · Résiliable à tout moment."
    >
      <SignupForm googleEnabled={googleEnabled} invitation={invitation ?? undefined} />
    </AuthShell>
  );
}
