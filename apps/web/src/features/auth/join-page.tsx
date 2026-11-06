import type { ReactNode } from "react";
import { AuthShell, AuthTitle, BrandAside } from "@/components/auth/auth-shell";
import { ButtonLink } from "@/components/ui/button";
import type { getJoinPage } from "@/functions/invitations";
import { ROLE_LABELS } from "@/lib/roles";
import { JoinButton } from "./join-button";

/** Lien d'invitation général d'un espace (écran 25, « Copier le lien d'invitation »). */
export function JoinPage({
  data: { token, link, signedIn, alreadyMember },
}: {
  data: Awaited<ReturnType<typeof getJoinPage>>;
}) {
  const body = (() => {
    if (!link) {
      return (
        <Message
          title="Lien expiré"
          text="Ce lien d'invitation n'est plus valable. Demande à l'équipe de t'en envoyer un nouveau."
        />
      );
    }
    const intro = `Tu es invité·e à rejoindre ${link.organizationName} sur Horaya, en tant que ${ROLE_LABELS[link.role].toLowerCase()}.`;
    if (!signedIn) {
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
    if (alreadyMember) {
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
