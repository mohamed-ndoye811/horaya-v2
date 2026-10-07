import type { Metadata } from "next";
import { AuthLead, AuthShell, AuthTitle, Eyebrow } from "@/components/auth/auth-shell";
import { ButtonLink } from "@/components/ui/button";
import { ResetPasswordForm } from "./reset-password-form";
import { findPasswordResetEmail } from "./reset-token";

export const metadata: Metadata = { title: "Nouveau mot de passe · Horaya" };

function maskEmail(email: string) {
  const [local = "", domain = ""] = email.split("@");
  return `${local.slice(0, 3)}•••@${domain}`;
}

/** Écran 14. Better Auth redirige ici avec ?token=… (ou ?error=INVALID_TOKEN). */
export default async function ResetPasswordPage({
  searchParams,
}: PageProps<"/nouveau-mot-de-passe">) {
  const { token } = await searchParams;
  const resetToken = typeof token === "string" ? token : "";
  const email = await findPasswordResetEmail(resetToken);

  return (
    <AuthShell
      topLink={{ prompt: "Un souci ?", label: "Nous écrire", href: "mailto:bonjour@horaya.app" }}
      footnote="Toutes tes autres sessions seront déconnectées par sécurité."
    >
      {email ? (
        <ResetPasswordForm token={resetToken} maskedEmail={maskEmail(email)} />
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
