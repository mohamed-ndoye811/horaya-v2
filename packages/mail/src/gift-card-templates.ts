import { renderEmail } from "./layout";
import type { EmailContent } from "./mailer";

/** Ce que l'e-mail d'un bon cadeau affiche (déjà mis en forme). */
export interface GiftCardMail {
  workspace: { name: string; color: string; textColor: string; logo?: string | null };
  /** « Camille » pour l'acheteur, « Léa » pour le bénéficiaire. */
  firstName: string;
  /** L'acheteur reçoit le bon pour l'offrir ; le bénéficiaire, un cadeau. */
  audience: "purchaser" | "recipient";
  purchaserName: string;
  recipientName: string;
  code: string;
  amount: string;
  expiresOn: string;
  message?: string | null;
  /** Texte d'accompagnement de l'organisateur. */
  workspaceMessage?: string | null;
  /** Page imprimable du bon. */
  cardUrl: string;
  bookUrl: string;
}

/** E-mail du bon, une fois payé : à l'acheteur, et au bénéficiaire s'il est renseigné. */
export function giftCardEmail(mail: GiftCardMail): EmailContent {
  const toRecipient = mail.audience === "recipient";
  return {
    subject: toRecipient
      ? `${mail.purchaserName} t'offre un bon cadeau ${mail.workspace.name}`
      : `Ton bon cadeau ${mail.workspace.name} pour ${mail.recipientName}`,
    ...renderEmail({
      preheader: `Bon cadeau de ${mail.amount}, valable jusqu'au ${mail.expiresOn}.`,
      title: toRecipient ? "Un cadeau pour toi !" : "Ton bon cadeau est prêt",
      paragraphs: [
        `Bonjour ${mail.firstName},`,
        toRecipient
          ? `${mail.purchaserName} t'offre un bon cadeau de ${mail.amount} chez ${mail.workspace.name}.`
          : `Le paiement est bien reçu : le bon cadeau de ${mail.amount} pour ${mail.recipientName} est actif. Tu peux l'imprimer ou le transférer tel quel.`,
        ...(mail.message ? [`« ${mail.message} »`] : []),
        ...(mail.workspaceMessage ? [mail.workspaceMessage] : []),
        `Pour l'utiliser, il suffit de saisir le code dans le champ « J'ai un bon cadeau » en réservant un atelier : ${mail.bookUrl}`,
      ],
      details: [
        ["Code", mail.code],
        ["Montant", mail.amount],
        ["Valable jusqu'au", mail.expiresOn],
      ],
      action: { label: "Voir et imprimer le bon", url: mail.cardUrl },
      footnote: `Cet e-mail est envoyé par ${mail.workspace.name} via Horaya, suite à l'achat d'un bon cadeau.`,
      brand: mail.workspace,
    }),
  };
}
