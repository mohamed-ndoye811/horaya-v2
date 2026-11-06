import type { ReactNode } from "react";
import { AuthShell, AuthTitle, BrandAside } from "@/components/auth/auth-shell";
import { ButtonLink } from "@/components/ui/button";
import type { getInvitationPage } from "@/functions/invitations";
import { ROLE_LABELS } from "@/lib/roles";
import { AcceptInvitation, SwitchAccount } from "./invitation-actions";

/** Page ouverte depuis l'e-mail d'invitation : rejoindre un espace existant. */
export function InvitationPage({
  data: { id, invitation: summary, sessionEmail },
}: {
  data: Awaited<ReturnType<typeof getInvitationPage>>;
}) {
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
          <ButtonLink
            href={sessionEmail ? "/app" : "/connexion"}
            size="lg"
            arrow
            className="w-full"
          >
            {sessionEmail ? "Ouvrir l'espace" : "Se connecter"}
          </ButtonLink>
        </Message>
      );
    }
    if (summary.status !== "pending" || summary.expired) {
      return (
        <Message
          title="Invitation expirée"
          text={`Cette invitation n'est plus valable. Demande à ${inviter} de t'en envoyer une nouvelle.`}
        />
      );
    }
    const intro = `${inviter} t'invite à rejoindre ${summary.organizationName} sur Horaya, en tant que ${ROLE_LABELS[summary.role].toLowerCase()}.`;
    if (!sessionEmail) {
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
    if (sessionEmail.toLowerCase() !== summary.email.toLowerCase()) {
      return (
        <Message
          title="Mauvais compte"
          text={`Tu es connecté avec ${sessionEmail}, mais l'invitation est adressée à ${summary.email}.`}
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

  return (
    <AuthShell
      aside={
        <BrandAside
          title="Rejoins l'équipe."
          lead="Ton équipe organise ses événements sur Horaya. Il ne manque plus que toi."
        />
      }
    >
      {body}
    </AuthShell>
  );
}

function Message({ title, text, children }: { title: string; text: string; children?: ReactNode }) {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <AuthTitle>{title}</AuthTitle>
        <p className="text-base leading-6 text-ink-muted">{text}</p>
      </div>
      {children}
    </div>
  );
}
