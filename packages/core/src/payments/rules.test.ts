import { describe, expect, it } from "vitest";
import { amountDueOnline, awaitsOnlinePayment, paidCents, refundForCancellation } from "./rules";

describe("paiements", () => {
  it("demande tout en ligne, ou l'acompte", () => {
    expect(amountDueOnline({ paymentMode: "online", amountCents: 24000, depositCents: null })).toBe(
      24000,
    );
    expect(
      amountDueOnline({ paymentMode: "deposit", amountCents: 24000, depositCents: 7200 }),
    ).toBe(7200);
    expect(
      amountDueOnline({ paymentMode: "on_site", amountCents: 24000, depositCents: null }),
    ).toBe(0);
  });

  it("additionne les paiements réussis moins les remboursements", () => {
    expect(
      paidCents([
        { kind: "charge", status: "succeeded", amountCents: 24000 },
        { kind: "charge", status: "failed", amountCents: 24000 },
        { kind: "refund", status: "succeeded", amountCents: 12000 },
      ]),
    ).toBe(12000);
  });

  it("attend le paiement d'une réservation confirmée non payée", () => {
    const booking = {
      status: "confirmed" as const,
      paymentMode: "online" as const,
      paymentStatus: "none" as const,
      amountCents: 3500,
      depositCents: null,
    };
    expect(awaitsOnlinePayment(booking)).toBe(true);
    expect(awaitsOnlinePayment({ ...booking, paymentStatus: "paid" })).toBe(false);
    expect(awaitsOnlinePayment({ ...booking, status: "pending" })).toBe(false);
  });
});

describe("remboursement à l'annulation", () => {
  const startsAt = new Date("2026-06-15T12:00:00Z");
  const policy = { freeCancellationHours: 72, lateCancellationRefundPercent: 50 };
  it("rembourse tout avant le délai, puis le pourcentage choisi", () => {
    expect(
      refundForCancellation({
        paidCents: 24000,
        cancelledBy: "customer",
        startsAt,
        now: new Date("2026-06-12T12:00:00Z"),
        policy,
      }),
    ).toBe(24000);
    expect(
      refundForCancellation({
        paidCents: 24000,
        cancelledBy: "customer",
        startsAt,
        now: new Date("2026-06-12T12:00:01Z"),
        policy,
      }),
    ).toBe(12000);
    expect(
      refundForCancellation({
        paidCents: 24000,
        cancelledBy: "customer",
        startsAt,
        now: new Date("2026-06-14T00:00:00Z"),
        policy: { freeCancellationHours: 0, lateCancellationRefundPercent: 0 },
      }),
    ).toBe(0);
  });
  it("rembourse tout quand l'organisateur annule", () => {
    expect(
      refundForCancellation({
        paidCents: 7200,
        cancelledBy: "organizer",
        startsAt,
        now: startsAt,
        policy,
      }),
    ).toBe(7200);
    expect(
      refundForCancellation({
        paidCents: 0,
        cancelledBy: "organizer",
        startsAt,
        now: startsAt,
        policy,
      }),
    ).toBe(0);
  });
});
