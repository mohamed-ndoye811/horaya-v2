import { saveNotificationPreferences } from "@horaya/core";
import { afterAll, describe, expect, it } from "vitest";
import {
  countUnreadNotifications,
  createNotifications,
  listNotifications,
  listNotificationsSince,
  markNotificationsRead,
} from "../src/queries";
import { createMember, createOrganization, db, testDeps } from "./helpers";

afterAll(() => db.$client.end());

const memberIdOf = (actor: Awaited<ReturnType<typeof createMember>>) =>
  actor.type === "member" ? actor.memberId : "";

describe("notifications dans l'app", () => {
  it("prévient les membres selon leurs préférences, puis les marque lues", async () => {
    const organizationId = await createOrganization();
    const owner = await createMember(organizationId);
    const editor = await createMember(organizationId, "editor");
    await saveNotificationPreferences(testDeps(), editor, [
      { type: "payment_received", email: false, inApp: false },
    ]);

    await createNotifications(db, organizationId, "payment_received", {
      title: "Paiement reçu",
      body: "Sophie Potier · 45 €",
      link: "/app/reservations/x",
    });
    // « Événement presque complet » n'est pas dans l'app par défaut.
    await createNotifications(db, organizationId, "event_almost_full", {
      title: "Presque complet",
    });

    const ownerId = memberIdOf(owner);
    expect(await listNotifications(db, memberIdOf(editor))).toEqual([]);
    const [entry, ...rest] = await listNotifications(db, ownerId);
    expect(rest).toEqual([]);
    expect(entry).toMatchObject({
      title: "Paiement reçu",
      link: "/app/reservations/x",
      readAt: null,
    });
    expect(await countUnreadNotifications(db, ownerId)).toBe(1);
    // En direct : seulement ce qui est arrivé après le dernier passage.
    expect(await listNotificationsSince(db, ownerId, new Date(0))).toHaveLength(1);
    const later = new Date((entry?.createdAt.getTime() ?? Date.now()) + 1000);
    expect(await listNotificationsSince(db, ownerId, later)).toEqual([]);

    await markNotificationsRead(db, ownerId);
    expect(await countUnreadNotifications(db, ownerId)).toBe(0);
  });
});
