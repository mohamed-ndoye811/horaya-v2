import { renderEmail } from "./layout";
import type { EmailContent } from "./mailer";

/** Ce que les e-mails aux participants affichent d'une réservation (déjà mis en forme). */
export interface BookingMail {
  workspace: { name: string; color: string; textColor: string };
  firstName: string;
  title: string;
  reference: string;
  when: string;
  where?: string | null;
  seats: number;
  /** « 240,00 € · à régler sur place », absent si gratuit. */
  amount?: string | null;
  /** Lien « Gérer ma réservation », ou page « Mes réservations » pour en recevoir un neuf. */
  manageUrl: string;
}

const places = (seats: number) => `${seats} place${seats > 1 ? "s" : ""}`;

function details(mail: BookingMail): Array<[string, string]> {
  return [
    ["Événement", mail.title],
    ["Quand", mail.when],
    ...(mail.where ? [["Où", mail.where] as [string, string]] : []),
    ["Places", String(mail.seats)],
    ...(mail.amount ? [["Montant", mail.amount] as [string, string]] : []),
    ["Réservation", mail.reference],
  ];
}

function bookingEmail(
  mail: BookingMail,
  content: {
    subject: string;
    title: string;
    preheader: string;
    paragraphs: string[];
    action?: { label: string; url: string };
  },
): EmailContent {
  return {
    subject: content.subject,
    ...renderEmail({
      preheader: content.preheader,
      title: content.title,
      paragraphs: [`Bonjour ${mail.firstName},`, ...content.paragraphs],
      details: details(mail),
      action: content.action ?? { label: "Gérer ma réservation", url: mail.manageUrl },
      footnote: `Cet e-mail t'est envoyé par ${mail.workspace.name} via Horaya, suite à ta réservation.`,
      brand: mail.workspace,
    }),
  };
}

export function bookingConfirmedEmail(mail: BookingMail): EmailContent {
  return bookingEmail(mail, {
    subject: `C'est réservé : ${mail.title}`,
    title: "C'est réservé !",
    preheader: `${places(mail.seats)} confirmée${mail.seats > 1 ? "s" : ""} pour ${mail.title}.`,
    paragraphs: [`Tes ${places(mail.seats)} pour « ${mail.title} » sont confirmées. À bientôt !`],
  });
}

export function bookingPendingEmail(mail: BookingMail): EmailContent {
  return bookingEmail(mail, {
    subject: `Demande reçue : ${mail.title}`,
    title: "Demande envoyée",
    preheader: `${mail.workspace.name} va valider ta demande.`,
    paragraphs: [
      `Ta demande de ${places(mail.seats)} pour « ${mail.title} » est bien arrivée. ${mail.workspace.name} la valide à la main : tu recevras un e-mail dès que c'est fait.`,
    ],
  });
}

export function bookingWaitlistedEmail(mail: BookingMail): EmailContent {
  return bookingEmail(mail, {
    subject: `Liste d'attente : ${mail.title}`,
    title: "Sur liste d'attente",
    preheader: "On te prévient dès qu'une place se libère.",
    paragraphs: [
      `« ${mail.title} » est complet pour l'instant. Tu es sur la liste d'attente : si une place se libère, ta demande passe automatiquement et tu reçois un e-mail.`,
    ],
  });
}

export function bookingPromotedEmail(mail: BookingMail & { confirmed: boolean }): EmailContent {
  return bookingEmail(mail, {
    subject: `Une place s'est libérée : ${mail.title}`,
    title: "Une place s'est libérée",
    preheader: mail.confirmed
      ? "Ta réservation est confirmée."
      : "Ta demande attend la validation de l'organisateur.",
    paragraphs: [
      mail.confirmed
        ? `Bonne nouvelle : des places se sont libérées pour « ${mail.title} ». Ta réservation est confirmée.`
        : `Des places se sont libérées pour « ${mail.title} ». Ta demande passe en attente de validation : tu recevras un e-mail dès que ${mail.workspace.name} l'aura validée.`,
    ],
  });
}

export function bookingRefusedEmail(
  mail: BookingMail & { reason?: string | null; eventsUrl: string },
): EmailContent {
  return bookingEmail(mail, {
    subject: `Demande non retenue : ${mail.title}`,
    title: "Demande non retenue",
    preheader: `${mail.workspace.name} n'a pas pu accepter ta demande.`,
    paragraphs: [
      `${mail.workspace.name} n'a pas pu accepter ta demande pour « ${mail.title} ».`,
      ...(mail.reason ? [`Motif : ${mail.reason}.`] : []),
      "Rien ne t'a été prélevé.",
    ],
    action: { label: "Voir les autres événements", url: mail.eventsUrl },
  });
}

export function bookingCancelledEmail(
  mail: BookingMail & { byCustomer: boolean; reason?: string | null; eventsUrl: string },
): EmailContent {
  return bookingEmail(mail, {
    subject: `Réservation annulée : ${mail.title}`,
    title: "Réservation annulée",
    preheader: mail.byCustomer
      ? "Ton annulation est bien prise en compte."
      : `${mail.workspace.name} a annulé ta réservation.`,
    paragraphs: [
      mail.byCustomer
        ? `Ton annulation pour « ${mail.title} » est bien prise en compte.`
        : `${mail.workspace.name} a annulé ta réservation pour « ${mail.title} ».`,
      ...(!mail.byCustomer && mail.reason ? [`Motif : ${mail.reason}.`] : []),
    ],
    action: { label: "Voir les autres événements", url: mail.eventsUrl },
  });
}

/** Lien neuf demandé depuis « Mes réservations » (un e-mail par réservation). */
export function bookingLinkEmail(mail: BookingMail): EmailContent {
  return bookingEmail(mail, {
    subject: `Ton lien de réservation : ${mail.title}`,
    title: "Ta réservation",
    preheader: "Le lien pour consulter ou annuler ta réservation.",
    paragraphs: [
      "Voici le lien pour consulter ou annuler ta réservation. Il remplace ceux reçus auparavant.",
    ],
  });
}

/** Prévient l'équipe d'une nouvelle réservation ou d'une annulation (préférences de notification). */
export function teamBookingEmail(input: {
  workspaceName: string;
  kind: "created" | "cancelled" | "paid";
  customerName: string;
  title: string;
  seats: number;
  status: string;
  url: string;
}): EmailContent {
  const texts = {
    created: {
      subject: `Nouvelle réservation : ${input.customerName} · ${input.title}`,
      title: "Nouvelle réservation",
      text: `${input.customerName} vient de réserver ${places(input.seats)} pour « ${input.title} » (${input.status}).`,
    },
    cancelled: {
      subject: `Annulation : ${input.customerName} · ${input.title}`,
      title: "Réservation annulée",
      text: `${input.customerName} a annulé sa réservation de ${places(input.seats)} pour « ${input.title} ».`,
    },
    paid: {
      subject: `Paiement reçu : ${input.customerName} · ${input.title}`,
      title: "Paiement reçu",
      text: `${input.customerName} a payé ${input.status} pour « ${input.title} ».`,
    },
  }[input.kind];
  return {
    subject: texts.subject,
    ...renderEmail({
      preheader: `${input.customerName} · ${places(input.seats)} · ${input.title}`,
      title: texts.title,
      paragraphs: [texts.text],
      action: { label: "Voir la réservation", url: input.url },
      footnote: `Tu reçois cet e-mail en tant que membre de ${input.workspaceName}. Règle tes notifications dans Paramètres › Paiements & notifications.`,
    }),
  };
}

/** Réservation retenue le temps du paiement en ligne (le lien permet de payer plus tard). */
export function bookingAwaitingPaymentEmail(
  /** `minutes` : places retenues le temps du paiement ; null pour une demande tout juste validée. */
  mail: BookingMail & { due: string; minutes: number | null },
): EmailContent {
  return bookingEmail(mail, {
    subject: `Plus qu'à payer : ${mail.title}`,
    title: "Plus qu'à payer",
    preheader: mail.minutes
      ? `Tes places sont retenues ${mail.minutes} minutes, le temps du paiement.`
      : "Ta demande est validée : règle ton paiement pour confirmer.",
    paragraphs: mail.minutes
      ? [
          `Tes ${places(mail.seats)} pour « ${mail.title} » sont retenues ${mail.minutes} minutes, le temps de régler ${mail.due} en ligne. Sans paiement, elles sont libérées pour d'autres participants.`,
          "Si la page de paiement s'est fermée, le lien ci-dessous permet de reprendre.",
        ]
      : [
          `Bonne nouvelle : ${mail.workspace.name} a validé ta demande pour « ${mail.title} ». Il ne reste plus qu'à régler ${mail.due} en ligne pour confirmer tes places.`,
        ],
    action: { label: `Payer ${mail.due}`, url: mail.manageUrl },
  });
}

/** Reçu de paiement (tout, ou l'acompte avec le reste à régler sur place). */
export function bookingPaymentReceivedEmail(
  mail: BookingMail & { paid: string; remaining?: string | null },
): EmailContent {
  return bookingEmail(mail, {
    subject: `Paiement reçu : ${mail.title}`,
    title: "Paiement reçu",
    preheader: `${mail.paid} reçus pour ${mail.title}.`,
    paragraphs: [
      `Merci ! ${mail.workspace.name} a bien reçu ${mail.paid} pour « ${mail.title} ». Ta réservation est confirmée.`,
      ...(mail.remaining ? [`Reste ${mail.remaining} à régler sur place.`] : []),
    ],
  });
}

export function bookingRefundedEmail(mail: BookingMail & { refunded: string }): EmailContent {
  return bookingEmail(mail, {
    subject: `Remboursement : ${mail.title}`,
    title: "Remboursement en route",
    preheader: `${mail.refunded} remboursés sur ta carte.`,
    paragraphs: [
      `${mail.workspace.name} t'a remboursé ${mail.refunded} pour « ${mail.title} ». Le montant apparaît sur ton compte sous 5 à 10 jours, selon ta banque.`,
    ],
  });
}
