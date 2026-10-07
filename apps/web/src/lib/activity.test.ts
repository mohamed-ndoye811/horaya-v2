import { describe, expect, it } from "vitest";
import { describeBookingActivity } from "./activity";
import { formatMoney } from "./format";

describe("describeBookingActivity", () => {
  it("raconte l'historique en français", () => {
    expect(
      describeBookingActivity({
        action: "booking.created",
        actorType: "customer",
        actorName: null,
        data: null,
      }).title,
    ).toBe("Demande reçue depuis la page publique");
    expect(
      describeBookingActivity({
        action: "booking.refused",
        actorType: "member",
        actorName: "Mohamed Ndoye",
        data: { reason: "Événement complet" },
      }).title,
    ).toBe("Demande refusée par Mohamed · Événement complet");
    expect(
      describeBookingActivity({
        action: "booking.cancelled",
        actorType: "member",
        actorName: null,
        data: { reason: "event_cancelled" },
      }).title,
    ).toBe("Annulée avec l'événement");
  });
});

describe("paiements dans l'historique", () => {
  it("raconte un paiement, un remboursement et une annulation faute de paiement", () => {
    const base = { actorType: "system" as const, actorName: null };
    expect(
      describeBookingActivity({
        ...base,
        action: "booking.paid",
        data: { amountCents: 7200, kind: "deposit" },
      }).title,
    ).toBe(`Acompte payé · ${formatMoney(7200)}`);
    expect(
      describeBookingActivity({ ...base, action: "booking.refunded", data: { amountCents: 1750 } })
        .title,
    ).toBe(`Remboursé · ${formatMoney(1750)}`);
    expect(
      describeBookingActivity({
        ...base,
        action: "booking.cancelled",
        data: { reason: "payment_expired" },
      }).title,
    ).toBe("Annulée : paiement en ligne non finalisé");
  });
});
