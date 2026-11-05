import { describe, expect, it } from "vitest";
import {
  cumulative,
  dailySeries,
  elapsed,
  joinNames,
  percentChange,
  sparklinePoints,
} from "./dashboard";

describe("tableau de bord", () => {
  it("calcule une variation, sauf sans point de comparaison", () => {
    expect(percentChange(114, 100)).toBe(14);
    expect(percentChange(97, 100)).toBe(-3);
    expect(percentChange(5, 0)).toBeNull();
  });

  it("remplit les jours vides d'une série et la cumule", () => {
    const series = dailySeries(
      { "2026-11-01": 2, "2026-11-03": 1 },
      { year: 2026, month: 11, day: 1 },
      { year: 2026, month: 11, day: 4 },
    );
    expect(series).toEqual([2, 0, 1, 0]);
    expect(cumulative(series)).toEqual([2, 2, 3, 3]);
  });

  it("place la courbe dans sa boîte, le maximum en haut", () => {
    expect(sparklinePoints([0, 5, 10], 100, 20)).toBe("0,20 50,10 100,0");
    expect(sparklinePoints([], 100, 20)).toBe("");
  });

  it("écrit les durées et les prénoms comme on les dit", () => {
    const now = new Date("2026-11-05T12:00:00Z");
    expect(elapsed(new Date("2026-11-05T11:48:00Z"), now)).toBe("12 min");
    expect(elapsed(new Date("2026-11-05T10:00:00Z"), now)).toBe("2 h");
    expect(elapsed(new Date("2026-11-02T12:00:00Z"), now)).toBe("3 j");
    expect(joinNames(["Camille", "Léa", "Antoine"])).toBe("Camille, Léa et Antoine");
    expect(joinNames(["Camille"])).toBe("Camille");
  });
});
