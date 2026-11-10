import { describe, expect, it } from "vitest";
import { nextSaturdayMorning } from "./starter";

describe("nextSaturdayMorning", () => {
  it("prend le samedi suivant à 10 h, heure de l'espace", () => {
    // Lundi 19 octobre 2026, 14 h à Paris.
    expect(
      nextSaturdayMorning(new Date("2026-10-19T12:00:00Z"), "Europe/Paris").toISOString(),
    ).toBe("2026-10-24T08:00:00.000Z");
  });

  it("saute au samedi d'après si c'est dans moins de deux jours", () => {
    // Vendredi 23 octobre : le lendemain serait trop court pour préparer la séance.
    expect(
      nextSaturdayMorning(new Date("2026-10-23T09:00:00Z"), "Europe/Paris").toISOString(),
    ).toBe("2026-10-31T09:00:00.000Z");
  });
});
