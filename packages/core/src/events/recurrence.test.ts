import { describe, expect, it } from "vitest";
import { ValidationError } from "../shared/errors";
import { generateOccurrences, recurrenceSchema, toRRule } from "./recurrence";

const PARIS = "Europe/Paris";
const iso = (dates: Date[]) => dates.map((date) => date.toISOString());

describe("generateOccurrences", () => {
  it("garde l'heure locale au passage à l'heure d'été", () => {
    // Mardi 24 mars 2026, 10 h à Paris (UTC+1) ; heure d'été le 29 mars.
    const dates = generateOccurrences(
      { frequency: "weekly", interval: 1, count: 3 },
      new Date("2026-03-24T09:00:00Z"),
      PARIS,
    );
    expect(iso(dates)).toEqual([
      "2026-03-24T09:00:00.000Z",
      "2026-03-31T08:00:00.000Z",
      "2026-04-07T08:00:00.000Z",
    ]);
  });

  it("gère plusieurs jours par semaine, sans revenir avant le premier", () => {
    // Mercredi 7 octobre 2026 ; lundis et mercredis.
    const dates = generateOccurrences(
      { frequency: "weekly", interval: 1, weekdays: [0, 2], count: 4 },
      new Date("2026-10-07T16:00:00Z"),
      PARIS,
    );
    expect(iso(dates)).toEqual([
      "2026-10-07T16:00:00.000Z",
      "2026-10-12T16:00:00.000Z",
      "2026-10-14T16:00:00.000Z",
      "2026-10-19T16:00:00.000Z",
    ]);
  });

  it("saute les mois sans le quantième en mensuel", () => {
    const dates = generateOccurrences(
      { frequency: "monthly", interval: 1, count: 3 },
      new Date("2027-01-31T09:00:00Z"),
      PARIS,
    );
    expect(iso(dates)).toEqual([
      "2027-01-31T09:00:00.000Z",
      "2027-03-31T08:00:00.000Z",
      "2027-05-31T08:00:00.000Z",
    ]);
  });

  it("s'arrête à la date de fin", () => {
    const dates = generateOccurrences(
      { frequency: "daily", interval: 2, until: new Date("2026-10-12T23:59:00Z") },
      new Date("2026-10-06T07:00:00Z"),
      PARIS,
    );
    expect(dates).toHaveLength(4);
  });

  it("refuse une série d'une seule occurrence", () => {
    expect(() =>
      generateOccurrences(
        { frequency: "monthly", interval: 1, until: new Date("2026-10-20T00:00:00Z") },
        new Date("2026-10-06T07:00:00Z"),
        PARIS,
      ),
    ).toThrow(ValidationError);
  });
});

describe("recurrenceSchema", () => {
  it("exige un nombre d'occurrences ou une date de fin, pas les deux", () => {
    expect(recurrenceSchema.safeParse({ frequency: "weekly" }).success).toBe(false);
    expect(
      recurrenceSchema.safeParse({ frequency: "weekly", count: 4, until: "2027-01-01" }).success,
    ).toBe(false);
  });
});

describe("toRRule", () => {
  it("produit une règle iCalendar lisible", () => {
    expect(toRRule({ frequency: "weekly", interval: 2, weekdays: [2, 0], count: 10 })).toBe(
      "FREQ=WEEKLY;INTERVAL=2;BYDAY=MO,WE;COUNT=10",
    );
  });
});
