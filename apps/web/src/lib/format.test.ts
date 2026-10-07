import { describe, expect, it } from "vitest";
import {
  formatDateTimeShort,
  formatHour,
  formatMoney,
  formatMonthShort,
  formatTimeRange,
  formatWeekdayShort,
  initials,
} from "./format";

const june17 = new Date("2026-06-17T09:00:00Z"); // 11h à Paris

describe("format", () => {
  it("affiche les montants sans centimes inutiles", () => {
    expect(formatMoney(24000)).toBe("240 €");
    expect(formatMoney(3550)).toBe("35,50 €");
    expect(formatMoney(432000)).toBe("4 320 €");
  });

  it("écrit les heures à la française", () => {
    expect(formatHour(june17)).toBe("11h");
    expect(formatTimeRange(june17, new Date("2026-06-17T10:30:00Z"))).toBe("11h – 12h30");
  });

  it("abrège jours et mois comme la maquette", () => {
    expect(formatWeekdayShort(june17)).toBe("Mer.");
    expect(formatMonthShort(june17)).toBe("Juin");
    expect(formatMonthShort(new Date("2026-07-08T09:00:00Z"))).toBe("Juil.");
    expect(formatMonthShort(new Date("2026-08-03T09:00:00Z"))).toBe("Août");
    expect(formatDateTimeShort(june17)).toBe("Mer. 17 juin · 11h");
  });

  it("calcule les initiales", () => {
    expect(initials("Léa Fontaine")).toBe("LF");
    expect(initials("Mohamed Ndoye Diallo")).toBe("MD");
    expect(initials("Camille")).toBe("CA");
  });
});
