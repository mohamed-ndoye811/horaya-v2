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
      footnote={
        <>
          En continuant, tu acceptes les{" "}
          <a
            href="/cgu"
            target="_blank"
            rel="noreferrer"
            className="underline underline-offset-[3px]"
          >
            conditions d'utilisation
          </a>{" "}
          et la{" "}
          <a
            href="/confidentialite"
            target="_blank"
            rel="noreferrer"
            className="underline underline-offset-[3px]"
          >
            politique de confidentialité
          </a>
          .
        </>
      }
    >
      <LoginForm googleEnabled={googleEnabled} invitation={invitation ?? undefined} />
    </AuthShell>
  );
}
