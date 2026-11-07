import { getWorkspaceBilling, grantPlan, revokePlanGrant, setBillingRate } from "@horaya/core";
import { afterAll, describe, expect, it } from "vitest";
import { getPlatformWorkspace, listPlatformUsers, listPlatformWorkspaces } from "../src/queries";
import { createMember, createOrganization, db, testDeps } from "./helpers";

afterAll(() => db.$client.end());

describe("cockpit de la plateforme", () => {
  it("retrouve un espace par l'e-mail de son propriétaire, avec son équipe", async () => {
    const organizationId = await createOrganization("PLT", { plan: "libre" });
    const owner = await createMember(organizationId);
    await createMember(organizationId, "editor");
    if (owner.type !== "member") throw new Error("membre attendu");
    const [account] = await listPlatformUsers(db, undefined).then((rows) =>
      rows.filter((row) => row.id === owner.userId),
    );
    expect(account?.workspaces).toEqual([
      { id: organizationId, name: "Cabinet Vidal", role: "owner" },
    ]);

    const found = await listPlatformWorkspaces(db, account?.email, new Date(0));
    expect(found).toHaveLength(1);
    expect(found[0]).toMatchObject({ id: organizationId, members: 2, recentBookings: 0 });
  });

  it("journalise licences et tarif avec la personne de l'équipe Horaya", async () => {
    const organizationId = await createOrganization("JRN", { plan: "libre" });
    const deps = testDeps();
    const grant = await grantPlan(
      deps,
      organizationId,
      { kind: "gift", plan: "equipe", days: 30, reason: "Partenaire" },
      "moh@horaya.app",
    );
    await setBillingRate(deps, organizationId, "solidaire", "moh@horaya.app");
    await revokePlanGrant(deps, organizationId, grant.id, "moh@horaya.app");

    const billing = await getWorkspaceBilling(deps, organizationId);
    expect(billing.current.plan).toBe("libre");
    expect(billing.account.rate).toBe("solidaire");

    const detail = await getPlatformWorkspace(db, organizationId);
    expect(detail?.history.map((entry) => entry.action)).toEqual([
      "billing.plan_revoked",
      "billing.rate_updated",
      "billing.plan_granted",
    ]);
    expect(detail?.history.every((entry) => entry.data?.by === "moh@horaya.app")).toBe(true);
  });
});
