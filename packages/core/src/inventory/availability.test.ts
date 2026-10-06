import { describe, expect, it } from "vitest";
import { ValidationError } from "../shared/errors";
import {
  type AllocationSnapshot,
  freeUnits,
  periodsOverlap,
  type UnitSnapshot,
} from "./availability";

const at = (day: number, hour = 0) => new Date(Date.UTC(2026, 5, day, hour));

const units: UnitSnapshot[] = [
  { id: "u1", status: "available" },
  { id: "u2", status: "available" },
  { id: "u3", status: "maintenance" },
];

const allocation = (
  itemUnitId: string,
  startsAt: Date,
  endsAt: Date,
  cancelledAt: Date | null = null,
): AllocationSnapshot => ({ itemUnitId, startsAt, endsAt, cancelledAt });

describe("periodsOverlap", () => {
  it("détecte un chevauchement partiel", () => {
    expect(
      periodsOverlap({ startsAt: at(15), endsAt: at(17) }, { startsAt: at(16), endsAt: at(18) }),
    ).toBe(true);
  });

  it("considère que des périodes bout à bout ne se chevauchent pas", () => {
    expect(
      periodsOverlap(
        { startsAt: at(15, 9), endsAt: at(15, 12) },
        { startsAt: at(15, 12), endsAt: at(15, 14) },
      ),
    ).toBe(false);
  });

  it("détecte une période incluse dans une autre", () => {
    expect(
      periodsOverlap({ startsAt: at(15), endsAt: at(20) }, { startsAt: at(16), endsAt: at(17) }),
    ).toBe(true);
  });
});

describe("freeUnits", () => {
  const period = { startsAt: at(18), endsAt: at(21) };

  it("exclut les exemplaires déjà occupés sur la période", () => {
    const free = freeUnits(units, [allocation("u1", at(18), at(22))], period);
    expect(free.map((unit) => unit.id)).toEqual(["u2"]);
  });

  it("ignore les allocations annulées", () => {
    const free = freeUnits(units, [allocation("u1", at(18), at(22), at(10))], period);
    expect(free.map((unit) => unit.id)).toEqual(["u1", "u2"]);
  });

  it("exclut les exemplaires hors service", () => {
    expect(freeUnits(units, [], period).map((unit) => unit.id)).not.toContain("u3");
  });

  it("rejette une période dont la fin précède le début", () => {
    expect(() => freeUnits(units, [], { startsAt: at(21), endsAt: at(18) })).toThrow(
      ValidationError,
    );
  });
});
