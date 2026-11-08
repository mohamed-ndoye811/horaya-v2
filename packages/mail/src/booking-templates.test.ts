import { describe, expect, it } from "vitest";
import {
  type BookingMail,
  bookingCancelledEmail,
  bookingConfirmedEmail,
  bookingFollowUpEmail,
  bookingRefusedEmail,
  bookingRescheduledEmail,
  enrollmentConfirmedEmail,
  passActivatedEmail,
  teamAlmostFullEmail,
  weeklyDigestEmail,
} from "./booking-templates";
import { giftCardEmail, teamGiftCardEmail } from "./gift-card-templates";
import { mixColors } from "./layout";
import { inlineImages } from "./mailer";
import { notchFlankPng } from "./notch";

const mail: BookingMail = {
  workspace: { name: "Cabinet Vidal", color: "#528D74", textColor: "#F7F5F3" },
  firstName: "Camille",
  title: "Séminaire annuel",
  reference: "HRY-2610-0001",
  when: "Lun. 15 juin, 14h → mar. 16 juin, 16h30",
  where: "445 rue de la Thèse, Puget-Ville",
  seats: 2,
  amount: "240,00 € · à régler sur place",
  manageUrl: "https://horaya.app/cabinet-vidal/reservation/jeton",
};

describe("e-mails aux participants", () => {
  it("ajoute les messages et les documents du type à la confirmation, pas à l'annulation", () => {
    const withModules = {
      ...mail,
      note: "Le code de la porte est 1234.",
      bring: "Un tablier",
      documents: [{ name: "Règlement", url: "https://horaya.app/fichiers/org/documents/a.pdf" }],
    };
    const confirmed = bookingConfirmedEmail(withModules);
    expect(confirmed.text).toContain("Le code de la porte est 1234.");
    expect(confirmed.text).toContain("À apporter : Un tablier");
    expect(confirmed.text).toContain("Règlement : https://horaya.app/fichiers/org/documents/a.pdf");
    expect(confirmed.html).toContain('href="https://horaya.app/fichiers/org/documents/a.pdf"');
    const cancelled = bookingCancelledEmail({ ...withModules, byCustomer: true, eventsUrl: "x" });
    expect(cancelled.text).not.toContain("Un tablier");
    expect(cancelled.text).not.toContain("Règlement");
    expect(bookingFollowUpEmail({ ...withModules, message: "Merci !" }).text).toContain("Merci !");
  });

  it("récapitule les réponses aux questions du type", () => {
    const email = bookingConfirmedEmail({ ...mail, answers: [["Niveau", "Débutant"]] });
    expect(email.text).toContain("Niveau : Débutant");
    expect(bookingConfirmedEmail(mail).text).not.toContain("Niveau");
  });

  it("porte la marque de l'espace, le récapitulatif et le lien de gestion", () => {
    const email = bookingConfirmedEmail(mail);
    expect(email.subject).toBe("C'est réservé : Séminaire annuel");
    expect(email.html).toContain("background:#528D74");
    expect(email.html).toContain("Cabinet Vidal");
    expect(email.html).not.toContain(">Horaya</span>");
    expect(email.text).toContain("Réservation : HRY-2610-0001");
    expect(email.text).toContain("Places : 2");
    expect(email.text).toContain(mail.manageUrl);
  });

  it("donne le motif d'un refus et renvoie vers les autres événements", () => {
    const email = bookingRefusedEmail({
      ...mail,
      reason: "Événement complet",
      eventsUrl: "https://horaya.app/cabinet-vidal",
    });
    expect(email.text).toContain("Motif : Événement complet.");
    expect(email.text).toContain("Voir les autres événements : https://horaya.app/cabinet-vidal");
  });

  it("annonce la nouvelle date avec le récapitulatif", () => {
    const email = bookingRescheduledEmail(mail);
    expect(email.subject).toBe("Nouvelle date : Séminaire annuel");
    expect(email.text).toContain(`Quand : ${mail.when}`);
    expect(email.text).toContain(`Gérer ma réservation : ${mail.manageUrl}`);
    expect(email.html).toContain("background:#528D74");
  });

  it("affiche le logo de l'espace dans l'en-tête quand il en a un", () => {
    const logo =
      "https://staging.horaya.app/fichiers/org/logos/0f3c2a4e-5b6d-4e7f-8a9b-0c1d2e3f4a5b.webp";
    const email = bookingConfirmedEmail({ ...mail, workspace: { ...mail.workspace, logo } });
    expect(email.html).toContain(`<img src="${logo}"`);
    expect(bookingConfirmedEmail(mail).html).not.toMatch(/<img src="(?!cid:)/);
  });
});

describe("e-mails à l'équipe", () => {
  const team = {
    workspaceName: "Cabinet Vidal",
    title: "Atelier",
    when: "Lun. 10 nov., 18h",
    url: "u",
  };

  it("dit combien de places restent, ou que c'est complet", () => {
    expect(teamAlmostFullEmail({ ...team, seats: 8, capacity: 10 })).toMatchObject({
      subject: "Presque complet : Atelier",
    });
    expect(teamAlmostFullEmail({ ...team, seats: 8, capacity: 10 }).text).toContain(
      "8 places prises sur 10, plus que 2 places",
    );
    const full = teamAlmostFullEmail({ ...team, seats: 10, capacity: 10 });
    expect(full.subject).toBe("Complet : Atelier");
    expect(full.text).toContain("plus aucune de libre");
  });

  it("résume la semaine et liste les événements à venir", () => {
    const email = weeklyDigestEmail({
      workspaceName: "Cabinet Vidal",
      bookings: 1,
      seats: 3,
      cancelled: 0,
      pending: 2,
      revenue: "45,00 €",
      upcoming: [{ day: "Lun. 10 nov.", text: "18:00 · Atelier · 8 / 10 places" }],
      url: "u",
    });
    expect(email.subject).toBe("Ta semaine sur Cabinet Vidal : 1 réservation");
    expect(email.text).toContain("1 réservation (3 places), 0 annulation, 45,00 € encaissés");
    expect(email.text).toContain("2 réservations attendent ta validation");
    expect(email.text).toContain("18:00 · Atelier · 8 / 10 places");
  });
});

describe("gabarit", () => {
  it("prend la teinte de l'espace, ou le logotype Horaya pour l'équipe", () => {
    expect(mixColors("#FFFFFF", "#000000", 0.5)).toBe("#808080");
    const branded = bookingConfirmedEmail(mail);
    expect(branded.html).toContain(`background:${mixColors("#528D74", "#111111", 0.16)}`);
    expect(branded.html).not.toContain("cid:horaya-logotype");
    expect(branded.text).toContain("Réservations propulsées par Horaya");
    const team = teamAlmostFullEmail({
      workspaceName: "Cabinet Vidal",
      title: "Atelier",
      when: "Lun. 10 nov., 18h",
      seats: 8,
      capacity: 10,
      url: "u",
    });
    expect(team.html).toContain('src="cid:horaya-logotype"');
  });
});

describe("notch", () => {
  it("joint les flancs du notch à la couleur du cadre, tracés comme dans l'app", () => {
    const images = inlineImages(bookingConfirmedEmail(mail).html);
    const tone = mixColors("#528D74", "#111111", 0.16).slice(1).toLowerCase();
    expect(images.map((image) => image.cid)).toEqual([`notch-left-${tone}`, `notch-right-${tone}`]);
    const png = notchFlankPng("left", "#111111");
    expect(png.subarray(1, 4).toString()).toBe("PNG");
    expect([png.readUInt32BE(16), png.readUInt32BE(20)]).toEqual([88, 100]);
  });
});

describe("e-mail d'inscription à une série", () => {
  it("récapitule chaque séance et mène au lien de gestion", () => {
    const email = enrollmentConfirmedEmail({
      workspace: mail.workspace,
      firstName: "Léa",
      title: "Tournage du mardi",
      sessions: ["mar. 18 nov., 18 h 30", "mar. 25 nov., 18 h 30"],
      amount: "300,00 € · à régler sur place",
      manageUrl: mail.manageUrl,
    });
    expect(email.subject).toBe("Inscription confirmée : Tournage du mardi");
    expect(email.text).toContain("Séance 2 : mar. 25 nov., 18 h 30");
    expect(email.text).toContain(`Gérer mon inscription : ${mail.manageUrl}`);
  });
});

describe("e-mail de carte", () => {
  it("annonce le solde et la date de fin", () => {
    const email = passActivatedEmail({
      workspace: mail.workspace,
      firstName: "Camille",
      name: "Carte 10 séances",
      sessions: 10,
      expiresOn: "30 juin 2027",
      eventsUrl: "https://horaya.app/cabinet-vidal",
    });
    expect(email.subject).toBe("Ta carte est active : Carte 10 séances");
    expect(email.text).toContain("Séances : 10");
    expect(email.text).toContain("Valable jusqu'au : 30 juin 2027");
  });
});

describe("e-mail du bon cadeau", () => {
  const gift = {
    workspace: mail.workspace,
    firstName: "Léa",
    audience: "recipient" as const,
    purchaserName: "Camille Roux",
    recipientName: "Léa Fontaine",
    code: "TERRE-8K2F",
    amount: "50,00 €",
    expiresOn: "8 novembre 2027",
    message: "Joyeux anniversaire",
    cardUrl: "https://horaya.app/cabinet-vidal/bon-cadeau/jeton",
    bookUrl: "https://horaya.app/cabinet-vidal",
  };

  it("au bénéficiaire : le code, le montant, l'échéance et le message de l'acheteur", () => {
    const email = giftCardEmail(gift);
    expect(email.subject).toBe("Camille Roux t'offre un bon cadeau Cabinet Vidal");
    expect(email.text).toContain("Code : TERRE-8K2F");
    expect(email.text).toContain("Joyeux anniversaire");
    expect(email.text).toContain(gift.cardUrl);
  });

  it("à l'acheteur : confirmation du paiement", () => {
    expect(giftCardEmail({ ...gift, audience: "purchaser", firstName: "Camille" }).subject).toBe(
      "Ton bon cadeau Cabinet Vidal pour Léa Fontaine",
    );
  });
});

describe("e-mail à l'équipe : bon cadeau acheté", () => {
  it("annonce l'acheteur, le montant et le code", () => {
    const email = teamGiftCardEmail({
      workspaceName: "Terre & Feu",
      purchaserName: "Camille Roy",
      recipientName: "Léa",
      amount: "50 €",
      code: "TERRE-8K2F7M3P",
      status: "en attente de paiement",
      url: "https://horaya.app/app/bons-cadeaux/x",
    });
    expect(email.subject).toBe("Bon cadeau acheté : Camille Roy · 50 €");
    expect(email.text).toContain("Code : TERRE-8K2F7M3P");
  });
});

describe("changement de date", () => {
  it("date plus chère : la différence et le lien de paiement", () => {
    const email = bookingRescheduledEmail({
      ...mail,
      due: "20 €",
      payUrl: "https://pay.example/atelier",
    });
    expect(email.text).toContain("il reste 20 € à régler");
    expect(email.text).toContain("Payer 20 € : https://pay.example/atelier");
    expect(bookingRescheduledEmail(mail).text).not.toContain("plus élevé");
  });
});
