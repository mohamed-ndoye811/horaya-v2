import { ConfirmLogin, LoginForm } from "./login-form";
import { FormShell, SpaceAside, SpaceTitle } from "./space-layout";

/** Maquette 8.1 : connexion sans mot de passe, chez un atelier ou sur horaya.app (`slug` null). */
export function CustomerLoginPage({
  slug,
  workspaceName,
  displayFont,
  image,
  email,
  token,
  minutes,
}: {
  slug: string | null;
  workspaceName: string | null;
  displayFont: string | null;
  image?: string | null;
  email: string;
  /** Arrivée par le lien de l'e-mail. */
  token: string | undefined;
  minutes: number;
}) {
  const where = workspaceName ? ` chez ${workspaceName}` : "";
  return (
    <FormShell
      aside={
        <SpaceAside eyebrow="Dans ton espace" image={image}>
          Tes prochaines réservations et ton historique{where}, et un lien pour les voir dans ton
          agenda.
        </SpaceAside>
      }
    >
      <div className="flex flex-col gap-2">
        <SpaceTitle displayFont={displayFont}>
          {workspaceName ? "Mon espace" : "Mes réservations"}
        </SpaceTitle>
        <p className="text-base leading-6 text-ink-muted">
          {token
            ? "Ton lien est prêt : un clic et tu retrouves tes réservations."
            : `Tes réservations${where}, au même endroit. Pas de mot de passe : on t'envoie un lien pour te connecter.`}
        </p>
      </div>
      {token ? (
        <ConfirmLogin slug={slug} token={token} />
      ) : (
        <LoginForm slug={slug} email={email} minutes={minutes} />
      )}
    </FormShell>
  );
}
