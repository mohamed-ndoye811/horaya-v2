import { describe, expect, it } from "vitest";
import { isRecreditDue, passAcceptsEventType, passBalance, passExpiry, passState } from "./rules";

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

describe("recrédit à l'annulation", () => {
  const startsAt = new Date("2026-11-11T10:00:00Z");
  it("le client est recrédité dans le délai, pas après", () => {
    const base = { byCustomer: true, startsAt, freeCancellationHours: 24 };
    expect(isRecreditDue({ ...base, now })).toBe(true);
    expect(isRecreditDue({ ...base, now: new Date("2026-11-10T10:00:01Z") })).toBe(false);
  });
  it("sans délai gratuit, le client n'est pas recrédité", () => {
    expect(isRecreditDue({ byCustomer: true, startsAt, now, freeCancellationHours: 0 })).toBe(
      false,
    );
  });
  it("l'organisateur recrédite toujours", () => {
    expect(
      isRecreditDue({ byCustomer: false, startsAt, now: startsAt, freeCancellationHours: 0 }),
    ).toBe(true);
  });
});
