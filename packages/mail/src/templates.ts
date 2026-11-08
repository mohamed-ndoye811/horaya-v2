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

/** Espace client (lot 29) : lien magique, au nom de l'espace quand il vient de ses pages. */
export function customerLoginEmail(input: {
  url: string;
  minutes: number;
  /** Espace depuis lequel le lien a été demandé ; sans lui, e-mail Horaya (vue horaya.app). */
  workspace?: { name: string; color: string; textColor: string; logo?: string | null };
}): EmailContent {
  const where = input.workspace ? `chez ${input.workspace.name}` : "sur Horaya";
  return {
    subject: `Ton lien de connexion à ton espace ${where}`,
    ...renderEmail({
      preheader: `Un clic pour retrouver tes réservations ${where}. Lien valable ${input.minutes} minutes.`,
      title: "Ton espace",
      paragraphs: [
        "Bonjour,",
        `Voici ton lien pour te connecter à ton espace ${where} : tes réservations, ton agenda et ton profil. Pas de mot de passe à retenir.`,
      ],
      action: { label: "Me connecter", url: input.url },
      footnote: `Ce lien est valable ${input.minutes} minutes et ne sert qu'une fois. Tu n'as rien demandé ? Ignore cet e-mail.`,
      brand: input.workspace,
    }),
  };
}
