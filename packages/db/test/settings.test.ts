import {
  type Actor,
  type Deps,
  ForbiddenError,
  saveNotificationPreferences,
  updateTenantSettings,
  withDefaultPreferences,
} from "@horaya/core";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import {
  deleteJoinLink,
  findUsableJoinLink,
  getInvitationSummary,
  getJoinLink,
  getNotificationPreferences,
  getWorkspaceSettings,
  listTeam,
  saveJoinLink,
} from "../src/queries";
import { invitation } from "../src/schema";
import { createMember, createOrganization, db, testDeps } from "./helpers";

afterAll(() => db.$client.end());

let organizationId: string;
let owner: Actor;
let deps: Deps;

beforeEach(async () => {
  organizationId = await createOrganization();
  owner = await createMember(organizationId);
  deps = testDeps();
});

describe("réglages de l'espace", () => {
  it("met à jour la marque et les paiements sans toucher au reste", async () => {
    await updateTenantSettings(deps, owner, { brandColor: "#528d74", displayFont: "ui" });
    await updateTenantSettings(deps, owner, {
      vatRateBps: 550,
      freeCancellationHours: 24,
      lateCancellationRefundPercent: 0,
    });
    const settings = await getWorkspaceSettings(db, organizationId);
    expect(settings).toMatchObject({
      brandColor: "#528D74",
      displayFont: "ui",
      vatRateBps: 550,
      defaultDepositPercent: 30,
      freeCancellationHours: 24,
      lateCancellationRefundPercent: 0,
    });
  });

  it("refuse les valeurs hors bornes et les rôles sans le droit", async () => {
    await expect(
      updateTenantSettings(deps, owner, { defaultDepositPercent: 120 }),
    ).rejects.toMatchObject({
      issues: [{ path: "defaultDepositPercent", message: "Acompte : 100 % maximum" }],
    });
    const editor = await createMember(organizationId, "editor");
    await expect(updateTenantSettings(deps, editor, { brandColor: "#000000" })).rejects.toThrow(
      ForbiddenError,
    );
  });
});

describe("notifications", () => {
  it("garde les réglages par défaut et enregistre les choix de chaque membre", async () => {
    const editor = await createMember(organizationId, "editor");
    expect(
      withDefaultPreferences(
        await getNotificationPreferences(db, editor.type === "member" ? editor.memberId : ""),
      ),
    ).toContainEqual({
      type: "payment_received",
      email: false,
      inApp: true,
    });
    await saveNotificationPreferences(deps, editor, [
      { type: "payment_received", email: true, inApp: false },
      { type: "weekly_digest", email: false, inApp: false },
    ]);
    await saveNotificationPreferences(deps, editor, [
      { type: "weekly_digest", email: true, inApp: false },
    ]);
    const saved = withDefaultPreferences(
      await getNotificationPreferences(db, editor.type === "member" ? editor.memberId : ""),
    );
    expect(saved.find((entry) => entry.type === "payment_received")).toEqual({
      type: "payment_received",
      email: true,
      inApp: false,
    });
    expect(saved.find((entry) => entry.type === "weekly_digest")?.email).toBe(true);
    expect(saved.find((entry) => entry.type === "booking_created")).toEqual({
      type: "booking_created",
      email: true,
      inApp: true,
    });
  });
});

describe("équipe", () => {
  it("liste les membres et les invitations en attente encore valables", async () => {
    if (owner.type !== "member") throw new Error("membre");
    const now = new Date("2026-10-07T10:00:00Z");
    const [pending] = await db
      .insert(invitation)
      .values([
        {
          organizationId,
          email: "julie.moreau@cabinet-vidal.fr",
          role: "viewer",
          status: "pending",
          expiresAt: new Date("2026-10-12T10:00:00Z"),
          createdAt: new Date("2026-10-05T10:00:00Z"),
          inviterId: owner.userId,
        },
        {
          organizationId,
          email: "expiree@cabinet-vidal.fr",
          role: "editor",
          status: "pending",
          expiresAt: new Date("2026-10-06T10:00:00Z"),
          inviterId: owner.userId,
        },
      ])
      .returning({ id: invitation.id });
    const team = await listTeam(db, organizationId, now);
    expect(team.members).toHaveLength(1);
    expect(team.members[0]?.role).toBe("owner");
    expect(team.invitations.map((entry) => entry.email)).toEqual(["julie.moreau@cabinet-vidal.fr"]);

    const summary = await getInvitationSummary(db, pending?.id ?? "");
    expect(summary).toMatchObject({
      email: "julie.moreau@cabinet-vidal.fr",
      role: "viewer",
      status: "pending",
      organizationName: "Cabinet Vidal",
      inviterName: "Mohamed Ndoye",
    });
  });
});

describe("lien d'invitation général", () => {
  it("ne vaut que jusqu'à son expiration et se remplace en régénérant", async () => {
    const now = new Date("2026-10-08T10:00:00Z");
    await saveJoinLink(db, {
      organizationId,
      token: "ancien-jeton-0123456789",
      role: "viewer",
      expiresAt: new Date("2026-10-15T10:00:00Z"),
      createdByMemberId: owner.type === "member" ? owner.memberId : null,
    });
    expect(await findUsableJoinLink(db, "ancien-jeton-0123456789", now)).toMatchObject({
      organizationId,
      role: "viewer",
    });
    expect(
      await findUsableJoinLink(db, "ancien-jeton-0123456789", new Date("2026-10-16T00:00:00Z")),
    ).toBeNull();

    await saveJoinLink(db, {
      organizationId,
      token: "nouveau-jeton-0123456789",
      role: "editor",
      expiresAt: new Date("2026-10-15T10:00:00Z"),
      createdByMemberId: null,
    });
    expect(await findUsableJoinLink(db, "ancien-jeton-0123456789", now)).toBeNull();
    expect(await getJoinLink(db, organizationId)).toMatchObject({
      token: "nouveau-jeton-0123456789",
      role: "editor",
    });

    await deleteJoinLink(db, organizationId);
    expect(await getJoinLink(db, organizationId)).toBeNull();
  });

  it("enregistre les coordonnées affichées sur la page publique", async () => {
    await updateTenantSettings(deps, owner, {
      contactEmail: "Contact@Cabinet-Vidal.fr",
      siret: "123 456 789 00012",
    });
    expect(await getWorkspaceSettings(db, organizationId)).toMatchObject({
      contactEmail: "contact@cabinet-vidal.fr",
      siret: "12345678900012",
      legalName: null,
    });
  });
});
