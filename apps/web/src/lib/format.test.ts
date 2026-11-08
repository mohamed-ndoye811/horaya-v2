import { describe, expect, it } from "vitest";
import {
  compactUnitLabels,
  formatDateTimeShort,
  formatHour,
  formatMoney,
  formatMonthShort,
  formatPublicSchedule,
  formatRelativeDateTime,
  formatRelativeDay,
  formatTimeRange,
  formatWeekdayShort,
  initials,
  plural,
} from "./format";

const june17 = new Date("2026-06-17T09:00:00Z"); // 11h à Paris

describe("format", () => {
  it("situe la prochaine venue d'un client", () => {
    const now = new Date("2026-06-15T20:00:00Z");
    expect(formatRelativeDay(new Date("2026-06-16T08:00:00Z"), "Europe/Paris", now)).toBe("demain");
    expect(formatRelativeDay(new Date("2026-06-15T08:00:00Z"), "Europe/Paris", now)).toBe(
      "aujourd'hui",
    );
    expect(formatRelativeDay(new Date("2026-06-20T08:00:00Z"), "Europe/Paris", now)).toBe(
      "le 20 juin",
    );
  });

  it("date une réservation par rapport à aujourd'hui", () => {
    const now = new Date("2026-06-17T14:00:00Z");
    expect(formatRelativeDateTime(new Date("2026-06-17T06:30:00Z"), "Europe/Paris", now)).toBe(
      "Aujourd'hui, 8:30",
    );
    expect(formatRelativeDateTime(new Date("2026-06-16T19:12:00Z"), "Europe/Paris", now)).toBe(
      "Hier, 21:12",
    );
    expect(formatRelativeDateTime(new Date("2026-06-14T09:20:00Z"), "Europe/Paris", now)).toBe(
      "14 juin, 11:20",
    );
  });

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

describe("formatEventRange", () => {
  it("écrit une période sur une journée ou plusieurs jours", async () => {
    const { formatEventRange, formatShortDateTime } = await import("./format");
    expect(
      formatEventRange(new Date("2026-06-17T09:00:00Z"), new Date("2026-06-17T10:30:00Z")),
    ).toBe("Mer. 17 juin · 11h – 12h30");
    expect(
      formatEventRange(new Date("2026-06-15T12:00:00Z"), new Date("2026-06-16T14:30:00Z")),
    ).toBe("Lun. 15 juin, 14h → mar. 16 juin, 16h30");
    expect(formatShortDateTime(new Date("2026-06-12T14:45:00Z"))).toBe("12/06 · 16:45");
  });
});

describe("compactUnitLabels", () => {
  it("trie numériquement et regroupe les plages", () => {
    expect(compactUnitLabels("#1, #10, #11, #2, #3, #5")).toBe("#1–#3, #5, #10, #11");
    expect(compactUnitLabels(Array.from({ length: 50 }, (_, i) => `#${i + 1}`).join(", "))).toBe(
      "#1–#50",
    );
    expect(compactUnitLabels("#2")).toBe("#2");
  });

  it("laisse tels quels les libellés non numériques", () => {
    expect(compactUnitLabels("A, B")).toBe("A, B");
  });
});

describe("formatPublicSchedule", () => {
  it("décrit un événement sur deux jours comme la maquette", () => {
    const schedule = formatPublicSchedule(
      new Date("2026-06-15T12:00:00Z"),
      new Date("2026-06-16T14:30:00Z"),
      "Europe/Paris",
    );
    expect(schedule).toEqual({
      hours: "14h → mar. 16h30",
      date: "Lun. 15 → mar. 16 juin 2026",
      schedule: "14h → 16h30 le lendemain",
    });
  });

  it("garde une seule date pour un événement d'une journée", () => {
    const schedule = formatPublicSchedule(
      new Date("2026-06-20T07:00:00Z"),
      new Date("2026-06-20T10:00:00Z"),
      "Europe/Paris",
    );
    expect(schedule).toEqual({
      hours: "9h – 12h",
      date: "Sam. 20 juin 2026",
      schedule: "9h – 12h",
    });
  });
});

describe("plural", () => {
  it("accorde au singulier jusqu'à 1 inclus", () => {
    expect(plural(0, "place")).toBe("0 place");
    expect(plural(1, "place")).toBe("1 place");
    expect(plural(2, "place")).toBe("2 places");
    expect(plural(1, "place libre", "places libres")).toBe("1 place libre");
    expect(plural(3, "place libre", "places libres")).toBe("3 places libres");
  });
});
