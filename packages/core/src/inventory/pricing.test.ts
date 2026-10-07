import { describe, expect, it } from "vitest";
import { priceRental, referencePrefix, rentalDays } from "./pricing";

describe("location de matériel", () => {
  it("facture toute journée entamée", () => {
    expect(rentalDays(new Date("2026-10-10T09:00:00Z"), new Date("2026-10-10T18:00:00Z"))).toBe(1);
    expect(rentalDays(new Date("2026-10-10T09:00:00Z"), new Date("2026-10-11T10:00:00Z"))).toBe(2);
    expect(
      priceRental(4500, 2, new Date("2026-10-10T09:00:00Z"), new Date("2026-10-12T09:00:00Z")),
    ).toBe(18000);
  });

  it("propose un préfixe de référence lisible", () => {
    expect(referencePrefix("Vidéoprojecteur Epson 4K")).toBe("VE");
    expect(referencePrefix("Sono")).toBe("SO");
    expect(referencePrefix("Écran")).toBe("EC");
  });
});
