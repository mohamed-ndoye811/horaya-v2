import { describe, expect, it } from "vitest";
import {
  type RescheduleTarget,
  rescheduleClosedReason,
  rescheduleDeadline,
  reschedulePricing,
  rescheduleTargetIssue,
} from "./reschedule";

const now = new Date("2026-11-08T10:00:00Z");
const from = { id: "a", eventTypeId: "stage", priceCents: 8500, paymentMode: "online" as const };
const to: RescheduleTarget = {
  ...from,
  id: "b",
  status: "published",
  visibility: "public",
  startsAt: new Date("2026-12-13T09:00:00Z"),
  capacity: 8,
  seatsHeld: 4,
};

describe("délai pour changer de date", () => {
  it("se ferme au délai d'annulation gratuite avant le début", () => {
    const startsAt = new Date("2026-11-22T09:00:00Z");
    expect(rescheduleDeadline(startsAt, 48).toISOString()).toBe("2026-11-20T09:00:00.000Z");
    const closed = (at: string) =>
      rescheduleClosedReason({
        status: "confirmed",
        startsAt,
        now: new Date(at),
        freeCancellationHours: 48,
      });
    expect(closed("2026-11-20T08:59:00Z")).toBeNull();
    expect(closed("2026-11-20T09:00:00Z")).toMatch(/délai/);
  });

  it("refuse une réservation annulée ou en liste d'attente", () => {
    const startsAt = new Date("2026-12-01T09:00:00Z");
    for (const status of ["cancelled", "refused", "waitlisted"] as const) {
      expect(rescheduleClosedReason({ status, startsAt, now, freeCancellationHours: 0 })).not.toBe(
        null,
      );
    }
  });
});

describe("dates proposées", () => {
  const issue = (target: Partial<RescheduleTarget>, seats = 1) =>
    rescheduleTargetIssue({ from, to: { ...to, ...target }, seats, now });

  it("accepte une autre date du même type, au même prix, avec assez de places", () => {
    expect(issue({})).toBeNull();
    expect(issue({ capacity: null })).toBeNull();
    expect(issue({}, 4)).toBeNull();
  });

  it("écarte la même date, un autre type, un brouillon ou une date sur invitation", () => {
    expect(issue({ id: "a" })).not.toBeNull();
    expect(issue({ eventTypeId: "cours" })).not.toBeNull();
    expect(issue({ status: "draft" })).not.toBeNull();
    expect(issue({ visibility: "invite_only" })).not.toBeNull();
  });

  it("accepte une date à un autre tarif (la différence se règle à part)", () => {
    expect(issue({ priceCents: 9000 })).toBeNull();
    expect(issue({ paymentMode: "on_site" })).toBeNull();
  });

  it("écarte une date passée, close ou sans assez de places", () => {
    expect(issue({ startsAt: new Date("2026-11-08T09:00:00Z") })).toMatch(/closes/);
    expect(issue({ startsAt: new Date("2026-11-08T12:00:00Z"), minAdvanceHours: 4 })).toMatch(
      /closes/,
    );
    expect(issue({ seatsHeld: 8 })).toMatch(/complète/);
    expect(issue({}, 5)).toMatch(/que 4 places/);
  });
});

describe("prix après changement de date", () => {
  const booking = {
    seats: 2,
    amountCents: 17000,
    depositCents: null,
    paymentMode: "online" as const,
    paymentStatus: "paid" as const,
    priceLines: [],
  };
  const target = (priceCents: number) => ({
    priceCents,
    paymentMode: "online" as const,
    modules: {},
  });

  it("plus cher : la réservation payée repasse à payer, la différence reste due", () => {
    const result = reschedulePricing({ booking, to: target(9500), paidCents: 17000 });
    expect(result).toMatchObject({ amountCents: 19000, paymentStatus: "none", dueCents: 2000 });
    expect(result.overpaidCents).toBe(0);
  });

  it("moins cher : pas de remboursement automatique, le trop-perçu est signalé", () => {
    const result = reschedulePricing({ booking, to: target(8000), paidCents: 17000 });
    expect(result).toMatchObject({ amountCents: 16000, paymentStatus: "paid", dueCents: 0 });
    expect(result.overpaidCents).toBe(1000);
  });

  it("même prix : rien ne change", () => {
    expect(reschedulePricing({ booking, to: target(8500), paidCents: 17000 })).toMatchObject({
      paymentStatus: "paid",
      dueCents: 0,
      overpaidCents: 0,
    });
  });

  it("acompte : le reste est calculé sur le nouvel acompte", () => {
    const result = reschedulePricing({
      booking: { ...booking, paymentMode: "deposit", depositCents: 5100, amountCents: 17000 },
      to: { priceCents: 10000, paymentMode: "deposit", modules: { deposit: { percent: 30 } } },
      paidCents: 5100,
    });
    expect(result).toMatchObject({ amountCents: 20000, depositCents: 6000, dueCents: 900 });
    expect(result.paymentStatus).toBe("none");
  });

  it("carte de séances : une séance vaut une séance", () => {
    const result = reschedulePricing({
      booking: { ...booking, paymentStatus: "paid_with_pass" },
      to: target(12000),
      paidCents: 0,
    });
    expect(result).toMatchObject({
      amountCents: 17000,
      paymentStatus: "paid_with_pass",
      dueCents: 0,
      overpaidCents: 0,
    });
  });
});
