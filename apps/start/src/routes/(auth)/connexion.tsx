import { createFileRoute } from "@tanstack/react-router";
import { AuthShell } from "@/components/auth/auth-shell";
import { LoginForm } from "@/features/auth/login-form";
import { authSearch, getAuthPage } from "@/functions/auth";

export const Route = createFileRoute("/(auth)/connexion")({
  validateSearch: authSearch,
  loaderDeps: ({ search }) => search,
  loader: ({ deps }) => getAuthPage({ data: deps }),
  head: () => ({ meta: [{ title: "Connexion · Horaya" }] }),
  component: LoginPage,
});

function LoginPage() {
  const { googleEnabled, invitation } = Route.useLoaderData();
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
