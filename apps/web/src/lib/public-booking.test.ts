import { describe, expect, it } from "vitest";
import {
  availability,
  bookingState,
  cancellationPolicy,
  describeRecurrence,
  pluralize,
} from "./public-booking";

describe("availability", () => {
  it("prévient dans le dernier tiers des places", () => {
    expect(availability(50, 38)).toMatchObject({
      remaining: 12,
      label: "Plus que 12 places",
      tone: "warning",
    });
    expect(availability(15, 10)).toMatchObject({ label: "Plus que 5 places", tone: "warning" });
    expect(availability(15, 7)).toMatchObject({ label: "8 places restantes", tone: "success" });
    expect(availability(12, 12)).toMatchObject({
      full: true,
      label: "Complet",
      tone: "info",
      ratio: 1,
    });
    expect(availability(null, 40)).toMatchObject({ remaining: null, label: "Places illimitées" });
  });
});

describe("bookingState", () => {
  const startsAt = new Date("2026-10-20T08:00:00Z");
  const now = new Date("2026-10-10T08:00:00Z");
  it("limite aux places restantes et au maximum par réservation", () => {
    expect(bookingState({ startsAt, capacity: 50, seatsHeld: 45, bookingRules: {} }, now)).toEqual({
      kind: "open",
      maxSeats: 5,
    });
    expect(
      bookingState(
        { startsAt, capacity: null, seatsHeld: 0, bookingRules: { maxSeatsPerBooking: 4 } },
        now,
      ),
    ).toEqual({ kind: "open", maxSeats: 4 });
  });
  it("passe en liste d'attente, complet ou clos", () => {
    expect(
      bookingState(
        { startsAt, capacity: 5, seatsHeld: 5, bookingRules: { waitlistEnabled: true } },
        now,
      ).kind,
    ).toBe("waitlist");
    expect(bookingState({ startsAt, capacity: 5, seatsHeld: 5, bookingRules: {} }, now).kind).toBe(
      "full",
    );
    expect(
      bookingState(
        { startsAt, capacity: 5, seatsHeld: 0, bookingRules: { minAdvanceHours: 24 * 11 } },
        now,
      ).kind,
    ).toBe("closed");
  });
});

describe("textes", () => {
  it("décrit la récurrence", () => {
    expect(describeRecurrence("FREQ=MONTHLY;INTERVAL=2")).toBe("Tous les 2 mois");
    expect(describeRecurrence("FREQ=WEEKLY;BYDAY=MO")).toBe("Toutes les semaines");
    expect(describeRecurrence("FREQ=WEEKLY;INTERVAL=3")).toBe("Toutes les 3 semaines");
    expect(describeRecurrence(null)).toBeNull();
  });
  it("résume la politique d'annulation", () => {
    const startsAt = new Date("2026-06-15T12:00:00Z");
    expect(
      cancellationPolicy(
        startsAt,
        { freeCancellationHours: 72, lateCancellationRefundPercent: 50 },
        "Europe/Paris",
      ),
    ).toBe("Annulation gratuite jusqu'au 12 juin. Ensuite, 50 % remboursés.");
    expect(
      cancellationPolicy(
        startsAt,
        { freeCancellationHours: 0, lateCancellationRefundPercent: 0 },
        "Europe/Paris",
      ),
    ).toBe("Annulation possible jusqu'au début, aucun remboursement.");
  });
  it("met au pluriel les types", () => {
    expect(pluralize("Séminaire")).toBe("Séminaires");
    expect(pluralize("Repas")).toBe("Repas");
  });
});
