import { describe, expect, it } from "vitest";
import { type BookingMail, bookingConfirmedEmail, bookingRefusedEmail } from "./booking-templates";

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
});
