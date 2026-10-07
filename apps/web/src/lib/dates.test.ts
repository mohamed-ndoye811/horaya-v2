import { describe, expect, it } from "vitest";
import { addMonths, isoWeek, mondayOf, parseCivilDate, startOfDay } from "./dates";

describe("dates", () => {
  it("lit une date AAAA-MM-JJ et refuse les dates impossibles", () => {
    expect(parseCivilDate("2026-06-15")).toEqual({ year: 2026, month: 6, day: 15 });
    expect(parseCivilDate("2026-02-30")).toBeNull();
    expect(parseCivilDate("n'importe quoi")).toBeNull();
  });

  it("calcule le lundi, le mois suivant et la semaine ISO", () => {
    expect(mondayOf({ year: 2026, month: 6, day: 18 })).toEqual({ year: 2026, month: 6, day: 15 });
    expect(addMonths({ year: 2026, month: 12, day: 15 }, 1)).toEqual({
      year: 2027,
      month: 1,
      day: 1,
    });
    expect(isoWeek({ year: 2026, month: 6, day: 15 })).toBe(25);
    expect(isoWeek({ year: 2027, month: 1, day: 1 })).toBe(53);
  });

  it("donne minuit dans le fuseau de l'espace", () => {
    expect(startOfDay({ year: 2026, month: 6, day: 15 }, "Europe/Paris").toISOString()).toBe(
      "2026-06-14T22:00:00.000Z",
    );
  });
});
