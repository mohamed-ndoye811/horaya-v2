import { describe, expect, it } from "vitest";
import {
  isRecreditDue,
  passAcceptsEventType,
  passBalance,
  passExpiry,
  passState,
  passValidForSession,
} from "./rules";

const now = new Date("2026-11-10T10:00:00Z");

describe("solde", () => {
  it("se déduit du journal", () => {
    expect(passBalance([{ delta: 10 }, { delta: -2 }, { delta: 1 }, { delta: -1 }])).toBe(8);
    expect(passBalance([])).toBe(0);
  });
});

describe("expiration", () => {
  it("ajoute la validité en jours à la date de paiement", () => {
    expect(passExpiry(new Date("2026-01-01T00:00:00Z"), 90).toISOString()).toBe(
      "2026-04-01T00:00:00.000Z",
    );
  });
  it("distingue les états", () => {
    const active = { status: "active" as const, expiresAt: new Date("2026-12-01T00:00:00Z") };
    expect(passState(active, 3, now)).toBe("active");
    expect(passState(active, 0, now)).toBe("exhausted");
    expect(passState({ ...active, expiresAt: now }, 3, now)).toBe("expired");
    expect(passState({ status: "pending", expiresAt: null }, 0, now)).toBe("pending");
  });
});

describe("types acceptés", () => {
  it("accepte tout quand la liste est vide", () => {
    expect(passAcceptsEventType({ eventTypeIds: [] }, "a")).toBe(true);
    expect(passAcceptsEventType({ eventTypeIds: ["b"] }, "a")).toBe(false);
    expect(passAcceptsEventType({ eventTypeIds: ["a", "b"] }, "a")).toBe(true);
  });
});

describe("validité à la date de la séance", () => {
  const pass = { expiresAt: new Date("2026-12-31T23:00:00Z") };
  it("accepte une séance avant la fin de validité, pas après", () => {
    expect(passValidForSession(pass, new Date("2026-12-30T18:00:00Z"))).toBe(true);
    expect(passValidForSession(pass, new Date("2027-01-05T18:00:00Z"))).toBe(false);
    expect(passValidForSession(pass, pass.expiresAt)).toBe(false);
  });
  it("une carte sans date de fin (pas encore payée) ne règle rien", () => {
    expect(passValidForSession({ expiresAt: null }, now)).toBe(false);
  });
});

describe("recrédit à l'annulation", () => {
  const startsAt = new Date("2026-11-11T10:00:00Z");
  it("le client est recrédité dans le délai, pas après", () => {
    const base = { cause: "customer" as const, startsAt, freeCancellationHours: 24 };
    expect(isRecreditDue({ ...base, now })).toBe(true);
    expect(isRecreditDue({ ...base, now: new Date("2026-11-10T10:00:01Z") })).toBe(false);
  });
  it("sans délai gratuit, le client n'est pas recrédité", () => {
    expect(isRecreditDue({ cause: "customer", startsAt, now, freeCancellationHours: 0 })).toBe(
      false,
    );
  });
  it("l'atelier qui annule l'événement entier recrédite toujours", () => {
    expect(
      isRecreditDue({ cause: "always", startsAt, now: startsAt, freeCancellationHours: 0 }),
    ).toBe(true);
  });
  it("une réservation annulée par l'équipe : dans le délai, recrédit par défaut", () => {
    const base = { cause: "team" as const, startsAt, freeCancellationHours: 24 };
    expect(isRecreditDue({ ...base, now })).toBe(true);
    expect(isRecreditDue({ ...base, now: new Date("2026-11-10T10:00:01Z") })).toBe(false);
  });
  it("l'équipe tranche : case cochée ou décochée l'emporte sur le délai", () => {
    const base = { cause: "team" as const, startsAt, freeCancellationHours: 24 };
    expect(isRecreditDue({ ...base, now, teamChoice: false })).toBe(false);
    expect(isRecreditDue({ ...base, now: startsAt, teamChoice: true })).toBe(true);
  });
});
