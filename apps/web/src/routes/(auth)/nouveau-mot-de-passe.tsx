import { createFileRoute } from "@tanstack/react-router";
import { AuthLead, AuthShell, AuthTitle, Eyebrow } from "@/components/auth/auth-shell";
import { ButtonLink } from "@/components/ui/button";
import { ResetPasswordForm } from "@/features/auth/reset-password-form";
import { getResetPasswordPage, resetSearch } from "@/functions/auth";

/** Écran 14. Better Auth redirige ici avec ?token=… (ou ?error=INVALID_TOKEN). */
export const Route = createFileRoute("/(auth)/nouveau-mot-de-passe")({
  validateSearch: resetSearch,
  loaderDeps: ({ search }) => ({ token: search.token ?? "" }),
  loader: ({ deps }) => getResetPasswordPage({ data: deps.token }),
  head: () => ({ meta: [{ title: "Nouveau mot de passe · Horaya" }] }),
  component: ResetPasswordPage,
});

function ResetPasswordPage() {
  const { token, maskedEmail } = Route.useLoaderData();
  return (
    <AuthShell
      topLink={{ prompt: "Un souci ?", label: "Nous écrire", href: "mailto:bonjour@horaya.app" }}
      footnote="Toutes tes autres sessions seront déconnectées par sécurité."
    >
      {maskedEmail ? (
        <ResetPasswordForm token={token} maskedEmail={maskedEmail} />
      ) : (
        <div className="flex flex-col gap-7">
          <div className="flex flex-col gap-3">
            <Eyebrow>Réinitialisation</Eyebrow>
            <AuthTitle>Lien expiré</AuthTitle>
            <AuthLead>
              Ce lien n'est plus valable : il a déjà servi ou ses 30 minutes sont écoulées.
              Demande-en un nouveau, ça prend quelques secondes.
            </AuthLead>
          </div>
          <ButtonLink size="lg" href="/mot-de-passe-oublie" arrow className="w-full">
            Demander un nouveau lien
          </ButtonLink>
        </div>
      )}
    </AuthShell>
  );
}
