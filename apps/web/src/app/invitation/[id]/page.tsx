import { getInvitationSummary } from "@horaya/db";
import type { Metadata } from "next";
import type { ReactNode } from "react";
import { AuthShell, AuthTitle, Eyebrow } from "@/components/auth/auth-shell";
import { ButtonLink } from "@/components/ui/button";
import { ROLE_LABELS } from "@/lib/roles";
import { getSession } from "@/server/auth";
import { db } from "@/server/db";
import { isInvitationId } from "@/server/invitation";
import { AcceptInvitation, SwitchAccount } from "./invitation-actions";

export const metadata: Metadata = { title: "Invitation · Horaya" };

/** Page ouverte depuis l'e-mail d'invitation : rejoindre un espace existant. */
export default async function InvitationPage({ params }: PageProps<"/invitation/[id]">) {
  const { id } = await params;
  const [summary, session] = await Promise.all([
    isInvitationId(id) ? getInvitationSummary(db, id) : null,
    getSession(),
  ]);

  const body = (() => {
    if (!summary) {
      return (
        <Message
          title="Invitation introuvable"
          text="Ce lien ne correspond à aucune invitation. Vérifie l'adresse ou demande un nouveau lien."
        />
      );
    }
    const inviter = summary.inviterName ?? "L'équipe";
    if (summary.status === "accepted") {
      return (
        <Message
          title="Déjà acceptée"
          text={`Cette invitation a déjà servi à rejoindre ${summary.organizationName}.`}
        >
          <ButtonLink href={session ? "/app" : "/connexion"} size="lg" arrow className="w-full">
            {session ? "Ouvrir l'espace" : "Se connecter"}
          </ButtonLink>
        </Message>
      );
    }
    if (summary.status !== "pending" || summary.expiresAt <= new Date()) {
      return (
        <Message
          title="Invitation expirée"
          text={`Cette invitation n'est plus valable. Demande à ${inviter} de t'en envoyer une nouvelle.`}
        />
      );
    }
    const intro = `${inviter} t'invite à rejoindre ${summary.organizationName} sur Horaya, en tant que ${ROLE_LABELS[summary.role].toLowerCase()}.`;
    if (!session) {
      return (
        <Message title={`Rejoins ${summary.organizationName}`} text={intro}>
          <div className="flex flex-col gap-3">
            <ButtonLink href={`/inscription?invitation=${id}`} size="lg" arrow className="w-full">
              Créer mon compte
            </ButtonLink>
            <ButtonLink href={`/connexion?invitation=${id}`} variant="secondary" className="w-full">
              J'ai déjà un compte
            </ButtonLink>
          </div>
        </Message>
      );
    }
    if (session.user.email.toLowerCase() !== summary.email.toLowerCase()) {
      return (
        <Message
          title="Mauvais compte"
          text={`Tu es connecté avec ${session.user.email}, mais l'invitation est adressée à ${summary.email}.`}
        >
          <SwitchAccount invitationId={id} />
        </Message>
      );
    }
    return (
      <Message title={`Rejoins ${summary.organizationName}`} text={intro}>
        <AcceptInvitation invitationId={id} organizationName={summary.organizationName} />
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
