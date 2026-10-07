import { describe, expect, it } from "vitest";
import { ConflictError, ValidationError } from "../shared/errors";
import type { Event } from "./model";
import { assertCanPublish, assertCapacityFits, assertEventConsistency } from "./rules";

const base = {
  startsAt: new Date("2026-11-10T09:00:00Z"),
  endsAt: new Date("2026-11-10T17:00:00Z"),
  priceCents: 0,
  paymentMode: "free" as const,
  depositPercent: null,
};

describe("assertEventConsistency", () => {
  it("accepte un événement gratuit cohérent", () => {
    expect(() => assertEventConsistency(base)).not.toThrow();
  });

  it("refuse une fin avant le début", () => {
    expect(() => assertEventConsistency({ ...base, endsAt: base.startsAt })).toThrow(
      ValidationError,
    );
  });

  it("exige un prix pour un événement payant et un pourcentage pour l'acompte", () => {
    try {
      assertEventConsistency({ ...base, paymentMode: "deposit" });
      expect.unreachable();
    } catch (error) {
      expect((error as ValidationError).issues.map((issue) => issue.path)).toEqual([
        "priceCents",
        "depositPercent",
      ]);
    }
  });
});

describe("assertCanPublish", () => {
  const draft = { ...base, status: "draft" } as Event;
  it("refuse de publier un événement passé", () => {
    expect(() => assertCanPublish(draft, new Date("2026-11-11T00:00:00Z"))).toThrow(ConflictError);
  });
  it("publie un brouillon à venir", () => {
    expect(() => assertCanPublish(draft, new Date("2026-11-01T00:00:00Z"))).not.toThrow();
  });
});

describe("assertCapacityFits", () => {
  it("refuse une jauge inférieure aux places occupées", () => {
    expect(() => assertCapacityFits(10, 12)).toThrow("12 places sont déjà réservées");
  });
  it("accepte l'illimité", () => {
    expect(() => assertCapacityFits(null, 500)).not.toThrow();
  });
});
