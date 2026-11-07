import {
  applySubscription,
  assertSeatAvailable,
  createItem,
  endSubscription,
  getBillingOverview,
  getCurrentPlan,
  grantPlan,
  PlanLimitError,
  revokePlanGrant,
  setBillingRate,
  startTrial,
} from "@horaya/core";
import { afterAll, describe, expect, it } from "vitest";
import { invitation } from "../src/schema";
import { createMember, createOrganization, db, fixedClock, testDeps } from "./helpers";

afterAll(() => db.$client.end());

describe("formules et licences", () => {
  it("donne Libre par défaut, puis l'essai Pro de 14 jours une seule fois", async () => {
    const organizationId = await createOrganization("LIB", { plan: "libre" });
    const clock = fixedClock();
    const deps = testDeps(clock);
    expect((await getCurrentPlan(deps, organizationId)).plan).toBe("libre");

    await startTrial(deps, organizationId);
    await startTrial(deps, organizationId);
    const trial = await getCurrentPlan(deps, organizationId);
    expect(trial).toMatchObject({ plan: "pro", source: "trial" });
    expect(trial.until).toEqual(new Date("2026-10-15T08:00:00Z"));

    clock.set(new Date("2026-10-16T00:00:00Z"));
    expect((await getCurrentPlan(deps, organizationId)).plan).toBe("libre");
  });

  it("bloque le matériel en Libre, sans toucher à l'existant, et le rouvre avec une licence", async () => {
    const organizationId = await createOrganization("MAT", { plan: "libre" });
    const owner = await createMember(organizationId);
    const deps = testDeps();
    await expect(createItem(deps, owner, { name: "Enceinte", quantity: 1 })).rejects.toThrow(
      PlanLimitError,
    );

    const grant = await grantPlan(deps, organizationId, {
      kind: "beta",
      plan: "pro",
      days: null,
      reason: "Bêta-testeur",
    });
    await expect(createItem(deps, owner, { name: "Enceinte", quantity: 1 })).resolves.toMatchObject(
      { name: "Enceinte" },
    );

    expect(await revokePlanGrant(deps, organizationId, grant.id)).toBe(true);
    expect((await getCurrentPlan(deps, organizationId)).plan).toBe("libre");
  });

  it("compte membres et invitations en attente dans les places de l'équipe", async () => {
    const organizationId = await createOrganization("SEA", { plan: "libre" });
    const owner = await createMember(organizationId);
    const deps = testDeps();
    await expect(assertSeatAvailable(deps, organizationId)).rejects.toThrow(PlanLimitError);

    await grantPlan(deps, organizationId, { kind: "gift", plan: "pro", days: 30, reason: null });
    if (owner.type !== "member") throw new Error("membre attendu");
    await db.insert(invitation).values({
      id: crypto.randomUUID(),
      organizationId,
      email: "invite@test.dev",
      role: "editor",
      status: "pending",
      expiresAt: new Date("2026-10-08T00:00:00Z"),
      inviterId: owner.userId,
    });
    await createMember(organizationId, "editor");
    // Propriétaire + éditeur + invitation : les 3 places de Pro sont prises.
    await expect(assertSeatAvailable(deps, organizationId)).rejects.toThrow(PlanLimitError);
  });

  it("applique l'abonnement Polar et le tarif, et l'affiche au propriétaire", async () => {
    const organizationId = await createOrganization("SUB", { plan: "libre" });
    const owner = await createMember(organizationId);
    const deps = testDeps();
    await setBillingRate(deps, organizationId, "solidaire");
    await applySubscription(deps, organizationId, {
      plan: "equipe",
      interval: "year",
      status: "active",
      polarCustomerId: `cus_${organizationId}`,
      polarSubscriptionId: `sub_${organizationId}`,
      currentPeriodEnd: new Date("2027-10-01T00:00:00Z"),
      cancelAtPeriodEnd: false,
    });

    const overview = await getBillingOverview(deps, owner);
    expect(overview.current).toMatchObject({ plan: "equipe", source: "subscription" });
    expect(overview.account.rate).toBe("solidaire");
    expect(overview.seats).toEqual({ used: 1, limit: null });
    expect(overview.bookings).toMatchObject({ limit: null, thisMonth: 0, over: false });
    expect(overview.canManage).toBe(true);
  });

  it("arrête l'abonnement passé sur un produit hors Horaya, pas un autre", async () => {
    const organizationId = await createOrganization("FIN", { plan: "libre" });
    const deps = testDeps(fixedClock());
    await applySubscription(deps, organizationId, {
      plan: "equipe",
      interval: "month",
      status: "active",
      polarCustomerId: `cus_${organizationId}`,
      polarSubscriptionId: `sub_${organizationId}`,
      currentPeriodEnd: new Date("2099-01-01T00:00:00Z"),
      cancelAtPeriodEnd: false,
    });
    expect(await endSubscription(deps, organizationId, "sub_autre")).toBe(false);
    expect((await getCurrentPlan(deps, organizationId)).plan).toBe("equipe");

    expect(await endSubscription(deps, organizationId, `sub_${organizationId}`)).toBe(true);
    expect((await getCurrentPlan(deps, organizationId)).plan).toBe("libre");
  });
});
