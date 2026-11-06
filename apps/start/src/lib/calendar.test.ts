import { describe, expect, it } from "vitest";
import { groupByDay, isAllDay, layoutDay, layoutSpans, monthGrid } from "./calendar";

const PARIS = "Europe/Paris";

describe("monthGrid", () => {
  it("couvre juin 2026 du lundi 1er au dimanche 5 juillet", () => {
    const weeks = monthGrid(2026, 6);
    expect(weeks).toHaveLength(5);
    expect(weeks[0]?.[0]).toEqual({ year: 2026, month: 6, day: 1, inMonth: true });
    expect(weeks[4]?.[6]).toEqual({ year: 2026, month: 7, day: 5, inMonth: false });
  });

  it("commence avant le 1er quand le mois ne débute pas un lundi", () => {
    const weeks = monthGrid(2026, 10);
    expect(weeks[0]?.[0]).toEqual({ year: 2026, month: 9, day: 28, inMonth: false });
  });
});

describe("layoutDay", () => {
  const at = (hour: number, minute = 0) => new Date(Date.UTC(2026, 5, 20, hour - 2, minute)); // heure de Paris (UTC+2)
  const day = { year: 2026, month: 6, day: 20 };

  it("partage la largeur entre deux événements qui se chevauchent", () => {
    const placed = layoutDay(
      [
        { id: "design", startsAt: at(9), endsAt: at(12) },
        { id: "meetup", startsAt: at(10), endsAt: at(12, 30) },
        { id: "seul", startsAt: at(14), endsAt: at(15) },
      ],
      day,
      PARIS,
      { startHour: 8, endHour: 20 },
    );
    const byId = Object.fromEntries(placed.map((entry) => [entry.item.id, entry]));
    expect(byId.design).toMatchObject({ top: 60, height: 180, column: 0, columns: 2 });
    expect(byId.meetup).toMatchObject({ top: 120, column: 1, columns: 2 });
    expect(byId.seul).toMatchObject({ column: 0, columns: 1 });
  });

  it("coupe ce qui dépasse de la plage affichée", () => {
    const [placed] = layoutDay([{ id: "tot", startsAt: at(7), endsAt: at(9) }], day, PARIS, {
      startHour: 8,
      endHour: 20,
    });
    expect(placed).toMatchObject({ top: 0, height: 60 });
  });
});

describe("isAllDay", () => {
  it("range les événements sur plusieurs jours dans la ligne « Jour »", () => {
    expect(
      isAllDay(
        {
          id: "seminaire",
          startsAt: new Date("2026-06-15T12:00:00Z"),
          endsAt: new Date("2026-06-16T14:30:00Z"),
        },
        PARIS,
      ),
    ).toBe(true);
    expect(
      isAllDay(
        {
          id: "atelier",
          startsAt: new Date("2026-06-17T09:00:00Z"),
          endsAt: new Date("2026-06-17T10:30:00Z"),
        },
        PARIS,
      ),
    ).toBe(false);
  });
});

describe("layoutSpans", () => {
  const week = Array.from({ length: 7 }, (_, offset) => ({
    year: 2026,
    month: 6,
    day: 15 + offset,
  }));

  it("place les événements sur plusieurs jours sans chevauchement", () => {
    const spans = layoutSpans(
      [
        {
          id: "seminaire",
          startsAt: new Date("2026-06-15T12:00:00Z"),
          endsAt: new Date("2026-06-16T14:30:00Z"),
        },
        {
          id: "inventaire",
          startsAt: new Date("2026-06-15T06:00:00Z"),
          endsAt: new Date("2026-06-15T20:00:00Z"),
        },
        {
          id: "festival",
          startsAt: new Date("2026-06-18T07:00:00Z"),
          endsAt: new Date("2026-06-23T16:00:00Z"),
        },
      ],
      week,
      PARIS,
    );
    const byId = Object.fromEntries(spans.map((span) => [span.item.id, span]));
    expect(byId.inventaire).toMatchObject({ startColumn: 0, endColumn: 0, lane: 0 });
    expect(byId.seminaire).toMatchObject({ startColumn: 0, endColumn: 1, lane: 1 });
    expect(byId.festival).toMatchObject({
      startColumn: 3,
      endColumn: 6,
      lane: 0,
      continuesAfter: true,
    });
  });
});

describe("groupByDay", () => {
  it("répète un événement sur chacun de ses jours", () => {
    const days = groupByDay(
      [
        {
          id: "seminaire",
          startsAt: new Date("2026-06-15T12:00:00Z"),
          endsAt: new Date("2026-06-16T14:30:00Z"),
        },
      ],
      PARIS,
    );
    expect([...days.keys()]).toEqual(["2026-06-15", "2026-06-16"]);
  });
});
