import { describe, expect, it } from "vitest";
import type { BillingAccount, PlanGrant } from "./model";
import {
  assertInventoryRoom,
  assertMemberRoom,
  bookingUsage,
  currentPlanOf,
  PlanLimitError,
} from "./rules";

const now = new Date("2026-11-07T12:00:00Z");
const later = new Date("2026-12-01T00:00:00Z");
const earlier = new Date("2026-11-01T00:00:00Z");
const free: BillingAccount = { organizationId: "o", rate: "standard", subscription: null };
const grant = (over: Partial<PlanGrant>): PlanGrant => ({
  id: "g",
  organizationId: "o",
  kind: "trial",
  plan: "pro",
  reason: null,
  expiresAt: later,
  revokedAt: null,
  createdAt: earlier,
  ...over,
});
const subscribed = (
  over: Partial<NonNullable<BillingAccount["subscription"]>>,
): BillingAccount => ({
  ...free,
  subscription: {
    plan: "pro",
    interval: "month",
    status: "active",
    polarCustomerId: "c",
    polarSubscriptionId: "s",
    currentPeriodEnd: later,
    cancelAtPeriodEnd: false,
    ...over,
  },
});

describe("currentPlanOf", () => {
  it("donne Libre sans abonnement ni licence", () => {
    expect(currentPlanOf(free, [], now)).toEqual({ plan: "libre", source: "free", until: null });
  });

  it("ignore une licence expirée ou retirée", () => {
    expect(currentPlanOf(free, [grant({ expiresAt: earlier })], now).plan).toBe("libre");
    expect(currentPlanOf(free, [grant({ revokedAt: earlier })], now).plan).toBe("libre");
  });

  it("garde l'essai jusqu'à sa fin", () => {
    expect(currentPlanOf(free, [grant({})], now)).toEqual({
      plan: "pro",
      source: "trial",
      until: later,
    });
  });

  it("prend la formule la plus haute, l'abonnement à égalité", () => {
    expect(currentPlanOf(subscribed({}), [grant({})], now).source).toBe("subscription");
    expect(currentPlanOf(subscribed({}), [grant({ kind: "gift", plan: "equipe" })], now).plan).toBe(
      "equipe",
    );
  });

  it("garde un abonnement résilié jusqu'à la fin de la période payée", () => {
    expect(currentPlanOf(subscribed({ status: "canceled" }), [], now).plan).toBe("pro");
    expect(
      currentPlanOf(subscribed({ status: "canceled", currentPeriodEnd: earlier }), [], now).plan,
    ).toBe("libre");
  });

  it("garde l'accès pendant un impayé", () => {
    expect(currentPlanOf(subscribed({ status: "past_due" }), [], now).plan).toBe("pro");
  });
});

describe("limites", () => {
  it("plafonne le matériel en Libre, pas en Pro", () => {
    expect(() => assertInventoryRoom("libre", 3, 2)).not.toThrow();
    expect(() => assertInventoryRoom("libre", 3, 3)).toThrow(PlanLimitError);
    expect(() => assertInventoryRoom("pro", 400, 100)).not.toThrow();
  });

  it("compte les places de l'équipe", () => {
    expect(() => assertMemberRoom("libre", 1)).toThrow(PlanLimitError);
    expect(() => assertMemberRoom("pro", 2)).not.toThrow();
    expect(() => assertMemberRoom("pro", 3)).toThrow(PlanLimitError);
    expect(() => assertMemberRoom("equipe", 500)).not.toThrow();
  });

  it("prévient au-delà du quota, propose la formule supérieure au deuxième mois", () => {
    expect(bookingUsage("libre", 40, 80)).toMatchObject({ over: false, suggestUpgrade: false });
    expect(bookingUsage("libre", 60, 20)).toMatchObject({ over: true, suggestUpgrade: false });
    expect(bookingUsage("libre", 60, 51)).toMatchObject({ over: true, suggestUpgrade: true });
    expect(bookingUsage("equipe", 9999, 9999)).toMatchObject({ limit: null, over: false });
  });
});
