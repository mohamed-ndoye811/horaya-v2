import { renderEmail } from "./layout";
import type { EmailContent } from "./mailer";

const greeting = (firstName?: string | null) => (firstName ? `Bonjour ${firstName},` : "Bonjour,");

export function passwordResetEmail(input: {
  firstName?: string | null;
  url: string;
}): EmailContent {
  return {
    subject: "Choisis un nouveau mot de passe",
    ...renderEmail({
      preheader: "Ton lien de réinitialisation Horaya, valable 30 minutes.",
      title: "Nouveau mot de passe",
      paragraphs: [
        greeting(input.firstName),
        "Tu as demandé à réinitialiser ton mot de passe Horaya. Le lien ci-dessous reste valable 30 minutes.",
      ],
      action: { label: "Choisir un mot de passe", url: input.url },
      footnote:
        "Tu n'es pas à l'origine de cette demande ? Ignore cet e-mail : ton mot de passe ne change pas.",
    }),
  };
}

export function emailVerificationEmail(input: {
  firstName?: string | null;
  url: string;
}): EmailContent {
  return {
    subject: "Confirme ton adresse e-mail",
    ...renderEmail({
      preheader: "Un clic pour confirmer ton adresse e-mail.",
      title: "Confirme ton e-mail",
      paragraphs: [
        greeting(input.firstName),
        "Bienvenue sur Horaya ! Confirme ton adresse pour sécuriser ton compte et recevoir tes notifications.",
      ],
      action: { label: "Confirmer mon e-mail", url: input.url },
      footnote: "Ce lien est valable 24 heures.",
    }),
  };
}

export function invitationEmail(input: {
  organizationName: string;
  inviterName: string;
  roleLabel: string;
  url: string;
}): EmailContent {
  return {
    subject: `${input.inviterName} t'invite sur ${input.organizationName}`,
    ...renderEmail({
      preheader: `Rejoins l'espace ${input.organizationName} sur Horaya.`,
      title: "Tu es invité·e",
      paragraphs: [
        "Bonjour,",
        `${input.inviterName} t'invite à rejoindre l'espace « ${input.organizationName} » sur Horaya, avec le rôle ${input.roleLabel}.`,
      ],
      action: { label: "Rejoindre l'espace", url: input.url },
      footnote: "Cette invitation expire dans 7 jours.",
    }),
  };
}
