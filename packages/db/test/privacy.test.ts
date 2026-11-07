import {
  createEvent,
  createEventBooking,
  createEventType,
  createItem,
  publishEvent,
} from "@horaya/core";
import { eq } from "drizzle-orm";
import { afterAll, describe, expect, it } from "vitest";
import { deleteWorkspace, ownedWorkspaces } from "../src/queries";
import { booking, customer, event, item, member, organization } from "../src/schema";
import { contact, createMember, createOrganization, customerActor, db, testDeps } from "./helpers";

afterAll(() => db.$client.end());

describe("suppressions (RGPD)", () => {
  it("liste les espaces possédés, pas ceux où l'on est simple membre", async () => {
    const mine = await createOrganization("OWN");
    const theirs = await createOrganization("OTH");
    const owner = await createMember(mine);
    if (owner.type !== "member") throw new Error("membre attendu");
    await db.insert(member).values({
      organizationId: theirs,
      userId: owner.userId,
      role: "editor",
      createdAt: new Date(),
    });
    expect((await ownedWorkspaces(db, owner.userId)).map((entry) => entry.id)).toEqual([mine]);
  });

  it("supprime un espace et toutes ses données, sans toucher aux autres", async () => {
    const organizationId = await createOrganization("DEL");
    const other = await createOrganization("KEP");
    const owner = await createMember(organizationId);
    const deps = testDeps();
    const type = await createEventType(deps, owner, { name: "Atelier", color: "#D8BC66" });
    const [created] = await createEvent(deps, owner, {
      eventTypeId: type.id,
      title: "Atelier à supprimer",
      startsAt: "2031-01-01T09:00:00Z",
      endsAt: "2031-01-01T10:00:00Z",
      timezone: "Europe/Paris",
      capacity: 5,
    });
    if (!created) throw new Error("Événement non créé");
    await publishEvent(deps, owner, created.id);
    await createEventBooking(deps, customerActor(organizationId), {
      eventId: created.id,
      seats: 1,
      customer: contact(),
    });
    await createItem(deps, owner, { name: "Enceinte", quantity: 2 });

    expect(await deleteWorkspace(db, organizationId)).toBe(true);
    for (const table of [event, booking, customer, item] as const) {
      expect(await db.select().from(table).where(eq(table.organizationId, organizationId))).toEqual(
        [],
      );
    }
    expect(await db.select().from(organization).where(eq(organization.id, other))).toHaveLength(1);
    expect(await deleteWorkspace(db, organizationId)).toBe(false);
  });
});
