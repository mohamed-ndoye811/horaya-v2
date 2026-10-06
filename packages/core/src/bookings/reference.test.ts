import { describe, expect, it } from "vitest";
import { formatBookingReference, referencePeriod } from "./reference";

describe("références de réservation", () => {
  it("formate PREFIXE-AAMM-NNNN", () => {
    expect(formatBookingReference("HRY", "2606", 388)).toBe("HRY-2606-0388");
  });

  it("ne tronque pas au-delà de 9999", () => {
    expect(formatBookingReference("HRY", "2606", 12345)).toBe("HRY-2606-12345");
  });

  it("calcule le mois dans le fuseau du tenant, pas en UTC", () => {
    // 31 mai 2026 à 23h30 UTC = 1er juin 01h30 à Paris
    const lateMayUtc = new Date(Date.UTC(2026, 4, 31, 23, 30));
    expect(referencePeriod(lateMayUtc, "Europe/Paris")).toBe("2606");
    expect(referencePeriod(lateMayUtc, "UTC")).toBe("2605");
  });
});
