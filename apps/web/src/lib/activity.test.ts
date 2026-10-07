import { describe, expect, it } from "vitest";
import { describeBookingActivity } from "./activity";

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
