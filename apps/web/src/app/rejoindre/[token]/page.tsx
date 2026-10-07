import { findUsableJoinLink } from "@horaya/db";
import type { Metadata } from "next";
import type { ReactNode } from "react";
import { AuthShell, AuthTitle, Eyebrow } from "@/components/auth/auth-shell";
import { ButtonLink } from "@/components/ui/button";
import { ROLE_LABELS } from "@/lib/roles";
import { getSession, listMyWorkspaces } from "@/server/auth";
import { db } from "@/server/db";
import { isJoinToken } from "@/server/invitation";
import { JoinButton } from "./join-button";

export const metadata: Metadata = {
  title: "Rejoindre un espace · Horaya",
  robots: { index: false },
};

/** Lien d'invitation général d'un espace (écran 25, « Copier le lien d'invitation »). */
export default async function JoinPage({ params }: PageProps<"/rejoindre/[token]">) {
  const { token } = await params;
  const [link, session] = await Promise.all([
    isJoinToken(token) ? findUsableJoinLink(db, token, new Date()) : null,
    getSession(),
  ]);

  const body = await (async () => {
    if (!link) {
      return (
        <Message
          title="Lien expiré"
          text="Ce lien d'invitation n'est plus valable. Demande à l'équipe de t'en envoyer un nouveau."
        />
      );
    }
    const intro = `Tu es invité·e à rejoindre ${link.organizationName} sur Horaya, en tant que ${ROLE_LABELS[link.role].toLowerCase()}.`;
    if (!session) {
      return (
        <Message title={`Rejoins ${link.organizationName}`} text={intro}>
          <div className="flex flex-col gap-3">
            <ButtonLink href={`/inscription?rejoindre=${token}`} size="lg" arrow className="w-full">
              Créer mon compte
            </ButtonLink>
            <ButtonLink
              href={`/connexion?rejoindre=${token}`}
              variant="secondary"
              className="w-full"
            >
              J'ai déjà un compte
            </ButtonLink>
          </div>
        </Message>
      );
    }
    const workspaces = await listMyWorkspaces();
    if (workspaces.some((workspace) => workspace.id === link.organizationId)) {
      return (
        <Message title="Déjà membre" text={`Tu fais déjà partie de ${link.organizationName}.`}>
          <ButtonLink href="/app" size="lg" arrow className="w-full">
            Ouvrir l'espace
          </ButtonLink>
        </Message>
      );
    }
    return (
      <Message title={`Rejoins ${link.organizationName}`} text={intro}>
        <JoinButton token={token} organizationName={link.organizationName} />
      </Message>
    );
  })();

  return <AuthShell>{body}</AuthShell>;
}

function Message({ title, text, children }: { title: string; text: string; children?: ReactNode }) {
  return (
    <div className="flex flex-col gap-7">
      <div className="flex flex-col gap-3">
        <Eyebrow>Invitation</Eyebrow>
        <AuthTitle>{title}</AuthTitle>
        <p className="text-base font-medium leading-6 text-ink-muted">{text}</p>
      </div>
      {children}
    </div>
  );
}
