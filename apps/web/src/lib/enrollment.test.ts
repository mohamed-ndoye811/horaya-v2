import { describe, expect, it } from "vitest";
import { enrollmentPayment } from "./enrollment";

describe("paiement d'une inscription", () => {
  const sessions = [{ paymentMode: "online", paymentLinkUrl: null }];

  it("propose le lien de paiement de l'espace pour un cours payé en ligne", () => {
    expect(
      enrollmentPayment({ amountCents: 30000, paidAt: null, sessions }, "https://pay.test"),
    ).toEqual({ label: "À payer en ligne", tone: "warning", payUrl: "https://pay.test" });
  });

  it("n'affiche rien pour une série gratuite, « Payé » une fois noté", () => {
    expect(enrollmentPayment({ amountCents: 0, paidAt: null, sessions }, null)).toBeNull();
    expect(enrollmentPayment({ amountCents: 300, paidAt: new Date(), sessions }, null)?.label).toBe(
      "Payé",
    );
  });

  it("renvoie vers l'atelier sans lien, ou sur place", () => {
    expect(enrollmentPayment({ amountCents: 300, paidAt: null, sessions }, null)?.label).toBe(
      "À régler auprès de l'atelier",
    );
    expect(
      enrollmentPayment(
        {
          amountCents: 300,
          paidAt: null,
          sessions: [{ paymentMode: "on_site", paymentLinkUrl: null }],
        },
        null,
      )?.label,
    ).toBe("À régler sur place");
  });
});
