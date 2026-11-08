import { renderEmail } from "./layout";
import type { EmailContent } from "./mailer";

/** Ce que les e-mails aux participants affichent d'une réservation (déjà mis en forme). */
export interface BookingMail {
  workspace: { name: string; color: string; textColor: string; logo?: string | null };
  firstName: string;
  title: string;
  reference: string;
  when: string;
  where?: string | null;
  seats: number;
  /** « 240,00 € · à régler sur place », absent si gratuit. */
  amount?: string | null;
  /** Lien « Gérer ma réservation », ou connexion à l'espace client quand le jeton n'est pas gardé. */
  manageUrl: string;
  /** Réponses aux questions du type (« Niveau », « Léa · Allergies »), déjà mises en forme. */
  answers?: Array<[string, string]>;
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
    ...(mail.answers ?? []),
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

/** Rappel la veille : `manageUrl` mène à la connexion de l'espace client (le lien d'origine n'est pas gardé). */
export function bookingReminderEmail(mail: BookingMail): EmailContent {
  return bookingEmail(mail, {
    subject: `C'est demain : ${mail.title}`,
    title: "C'est demain !",
    preheader: `${mail.title} · ${mail.when}`,
    paragraphs: [
      `Petit rappel : « ${mail.title} », c'est demain. On t'attend !`,
      "Un empêchement ? Tu peux gérer ta réservation en ligne.",
    ],
    action: { label: "Voir mes réservations", url: mail.manageUrl },
  });
}

/** Rappel la veille à l'équipe : l'événement de demain et ses inscrits. */
export function teamReminderEmail(input: {
  workspaceName: string;
  title: string;
  when: string;
  seats: number;
  capacity: number | null;
  url: string;
}): EmailContent {
  const filled = input.capacity
    ? `${input.seats} place${input.seats > 1 ? "s" : ""} réservée${input.seats > 1 ? "s" : ""} sur ${input.capacity}`
    : `${places(input.seats)} réservée${input.seats > 1 ? "s" : ""}`;
  return {
    subject: `Demain : ${input.title}`,
    ...renderEmail({
      preheader: `${input.when} · ${filled}`,
      title: "C'est demain",
      paragraphs: [`« ${input.title} » a lieu demain, ${input.when}. ${filled}.`],
      action: { label: "Voir l'événement", url: input.url },
      footnote: `Tu reçois cet e-mail en tant que membre de ${input.workspaceName}. Règle tes notifications dans Paramètres › Notifications.`,
    }),
  };
}

const teamFootnote = (workspaceName: string) =>
  `Tu reçois cet e-mail en tant que membre de ${workspaceName}. Règle tes notifications dans Paramètres › Paiements & notifications.`;

/** Préférence « Événement presque complet » : 80 % de la jauge atteinte (ou complet d'un coup). */
export function teamAlmostFullEmail(input: {
  workspaceName: string;
  title: string;
  when: string;
  seats: number;
  capacity: number;
  url: string;
}): EmailContent {
  const left = input.capacity - input.seats;
  const full = left <= 0;
  return {
    subject: `${full ? "Complet" : "Presque complet"} : ${input.title}`,
    ...renderEmail({
      preheader: `${input.seats} / ${input.capacity} places · ${input.when}`,
      title: full ? "C'est complet" : "Presque complet",
      paragraphs: [
        `« ${input.title} » (${input.when}) : ${places(input.seats)} prise${input.seats > 1 ? "s" : ""} sur ${input.capacity}, ${full ? "plus aucune de libre" : `plus que ${places(left)}`}.`,
        full
          ? "Si la demande continue, c'est peut-être le moment d'ouvrir une autre date."
          : "Si la demande continue, tu peux agrandir la jauge ou prévoir une autre date.",
      ],
      action: { label: "Voir l'événement", url: input.url },
      footnote: teamFootnote(input.workspaceName),
    }),
  };
}

/** Préférence « Récap hebdomadaire » : la semaine écoulée et les 7 prochains jours, le lundi matin. */
export function weeklyDigestEmail(input: {
  workspaceName: string;
  bookings: number;
  seats: number;
  cancelled: number;
  pending: number;
  /** Encaissé sur la semaine, déjà mis en forme ; null si rien. */
  revenue: string | null;
  /** Événements des 7 prochains jours : jour (« lun. 10 nov. ») et ligne (« 18:00 · Atelier · 8 / 12 places »). */
  upcoming: Array<{ day: string; text: string }>;
  url: string;
}): EmailContent {
  const plural = (count: number, word: string) => `${count} ${word}${count > 1 ? "s" : ""}`;
  const week = [
    `${plural(input.bookings, "réservation")} (${places(input.seats)})`,
    plural(input.cancelled, "annulation"),
    ...(input.revenue ? [`${input.revenue} encaissés`] : []),
  ].join(", ");
  return {
    subject: `Ta semaine sur ${input.workspaceName} : ${plural(input.bookings, "réservation")}`,
    ...renderEmail({
      preheader: `${week}. ${plural(input.upcoming.length, "événement")} dans les 7 prochains jours.`,
      title: "Ta semaine",
      paragraphs: [
        `Ces 7 derniers jours : ${week}.`,
        ...(input.pending
          ? [
              `${input.pending > 1 ? `${input.pending} réservations attendent` : "Une réservation attend"} ta validation.`,
            ]
          : []),
        input.upcoming.length
          ? "Dans les 7 prochains jours :"
          : "Aucun événement prévu dans les 7 prochains jours.",
      ],
      details: input.upcoming.map((entry): [string, string] => [entry.day, entry.text]),
      action: { label: "Ouvrir le tableau de bord", url: input.url },
      footnote: teamFootnote(input.workspaceName),
    }),
  };
}

/**
 * Espace client : la réservation a changé de date (maquette 8.3). Nouvelle date plus chère :
 * `due` est la différence à régler et `payUrl` le lien de paiement (comme une réservation normale).
 */
export function bookingRescheduledEmail(
  mail: BookingMail & { due?: string | null; payUrl?: string | null },
): EmailContent {
  const pay = mail.due && mail.payUrl ? { due: mail.due, url: mail.payUrl } : null;
  return bookingEmail(mail, {
    subject: `Nouvelle date : ${mail.title}`,
    title: "Nouvelle date",
    preheader: `Ta réservation passe au ${mail.when}.`,
    paragraphs: [
      "Ta réservation a bien changé de date. Voici le nouveau récapitulatif.",
      ...(pay ? [`Le tarif de cette date est plus élevé : il reste ${pay.due} à régler.`] : []),
    ],
    ...(pay ? { action: { label: `Payer ${pay.due}`, url: pay.url } } : {}),
  });
}

/** Prévient l'équipe d'une nouvelle réservation ou d'une annulation (préférences de notification). */
export function teamBookingEmail(input: {
  workspaceName: string;
  kind: "created" | "cancelled" | "paid" | "rescheduled";
  customerName: string;
  title: string;
  seats: number;
  status: string;
  url: string;
  /** Réponses du client aux questions du type, déjà mises en forme. */
  answers?: Array<[string, string]>;
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
    rescheduled: {
      subject: `Changement de date : ${input.customerName} · ${input.title}`,
      title: "Changement de date",
      text: `${input.customerName} a changé de date pour « ${input.title} » (${places(input.seats)}) : ${input.status}.`,
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
      details: input.answers ?? [],
      action: { label: "Voir la réservation", url: input.url },
      footnote: `Tu reçois cet e-mail en tant que membre de ${input.workspaceName}. Règle tes notifications dans Paramètres › Paiements & notifications.`,
    }),
  };
}

/**
 * « Plus qu'à payer » :
 * - `checkout` : places retenues le temps du paiement intégré (le lien permet de reprendre) ;
 * - `validated` : demande validée par l'équipe, paiement en ligne à faire ;
 * - `link` : paiement via le lien externe de l'organisateur, qui confirme ensuite la réception.
 */
export function bookingAwaitingPaymentEmail(
  mail: BookingMail & {
    due: string;
    reason: "checkout" | "validated" | "link";
    payUrl: string;
    minutes?: number;
  },
): EmailContent {
  const paragraphs = {
    checkout: [
      `Tes ${places(mail.seats)} pour « ${mail.title} » sont retenues ${mail.minutes ?? 30} minutes, le temps de régler ${mail.due} en ligne. Sans paiement, elles sont libérées pour d'autres participants.`,
      "Si la page de paiement s'est fermée, le lien ci-dessous permet de reprendre.",
    ],
    validated: [
      `Bonne nouvelle : ${mail.workspace.name} a validé ta demande pour « ${mail.title} ». Il ne reste plus qu'à régler ${mail.due} en ligne pour confirmer tes places.`,
    ],
    link: [
      `Tes ${places(mail.seats)} pour « ${mail.title} » sont réservées. Règle ${mail.due} via le lien de paiement de ${mail.workspace.name} : tu recevras un reçu dès qu'il aura confirmé la réception.`,
      `Pour consulter ou annuler ta réservation : ${mail.manageUrl}`,
    ],
  }[mail.reason];
  return bookingEmail(mail, {
    subject: `Plus qu'à payer : ${mail.title}`,
    title: "Plus qu'à payer",
    preheader:
      mail.reason === "checkout"
        ? `Tes places sont retenues ${mail.minutes ?? 30} minutes, le temps du paiement.`
        : mail.reason === "validated"
          ? "Ta demande est validée : règle ton paiement pour confirmer."
          : `Règle ${mail.due} pour finaliser ta réservation.`,
    paragraphs,
    action: { label: `Payer ${mail.due}`, url: mail.payUrl },
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

export function bookingRefundedEmail(
  mail: BookingMail & {
    refunded: string /** Remboursement fait hors Horaya et noté par l'équipe. */;
    manual?: boolean;
  },
): EmailContent {
  return bookingEmail(mail, {
    subject: `Remboursement : ${mail.title}`,
    title: "Remboursement en route",
    preheader: `${mail.refunded} remboursés.`,
    paragraphs: [
      mail.manual
        ? `${mail.workspace.name} t'a remboursé ${mail.refunded} pour « ${mail.title} », par le même moyen que ton paiement. Selon ta banque, comptes quelques jours.`
        : `${mail.workspace.name} t'a remboursé ${mail.refunded} pour « ${mail.title} ». Le montant apparaît sur ton compte sous 5 à 10 jours, selon ta banque.`,
    ],
  });
}

/** Inscription à toute une série (cours à l'année) : le récapitulatif des séances réservées. */
export function enrollmentConfirmedEmail(input: {
  workspace: BookingMail["workspace"];
  firstName: string;
  title: string;
  /** Séances réservées, déjà mises en forme (« mar. 18 nov., 18 h 30 »). */
  sessions: string[];
  where?: string | null;
  /** « 300,00 € · à régler sur place ». */
  amount?: string | null;
  /** Lien de paiement externe, si l'inscription se règle en ligne. */
  payUrl?: string | null;
  manageUrl: string;
}): EmailContent {
  const count = `${input.sessions.length} séance${input.sessions.length > 1 ? "s" : ""}`;
  return {
    subject: `Inscription confirmée : ${input.title}`,
    ...renderEmail({
      preheader: `${count} réservées pour ${input.title}.`,
      title: "Tu es inscrit·e !",
      paragraphs: [
        `Bonjour ${input.firstName},`,
        `Ton inscription à « ${input.title} » est confirmée : une place t'attend à chacune des ${count} ci-dessous.`,
        ...(input.payUrl
          ? [
              `Règle ton inscription via le lien de paiement de ${input.workspace.name} : ${input.payUrl}`,
            ]
          : []),
        "Un empêchement ? Signale ton absence depuis le lien ci-dessous : ta place profite à quelqu'un d'autre, ton inscription reste.",
      ],
      details: [
        ["Cours", input.title],
        ...(input.where ? [["Où", input.where] as [string, string]] : []),
        ...(input.amount ? [["Montant", input.amount] as [string, string]] : []),
        ...input.sessions.map(
          (session, index) => [`Séance ${index + 1}`, session] as [string, string],
        ),
      ],
      action: { label: "Gérer mon inscription", url: input.manageUrl },
      footnote: `Cet e-mail t'est envoyé par ${input.workspace.name} via Horaya, suite à ton inscription.`,
      brand: input.workspace,
    }),
  };
}

/** Carte de séances payée : elle est active, avec son solde et sa date de fin. */
export function passActivatedEmail(input: {
  workspace: BookingMail["workspace"];
  firstName: string;
  name: string;
  sessions: number;
  expiresOn: string;
  eventsUrl: string;
}): EmailContent {
  return {
    subject: `Ta carte est active : ${input.name}`,
    ...renderEmail({
      preheader: `${places(input.sessions).replace("place", "séance")} à utiliser jusqu'au ${input.expiresOn}.`,
      title: "Ta carte est active",
      paragraphs: [
        `Bonjour ${input.firstName},`,
        `Ton paiement est bien reçu : ta carte « ${input.name} » est active. Chaque réservation utilise une séance ; une réservation annulée à temps te la rend.`,
      ],
      details: [
        ["Carte", input.name],
        ["Séances", String(input.sessions)],
        ["Valable jusqu'au", input.expiresOn],
      ],
      action: { label: "Voir les prochains événements", url: input.eventsUrl },
      footnote: `Cet e-mail t'est envoyé par ${input.workspace.name} via Horaya, suite à l'achat de ta carte.`,
      brand: input.workspace,
    }),
  };
}
