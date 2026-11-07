import {
  cancelEvent,
  createEvent,
  createEventBooking,
  createEventType,
  getCalendarFeed,
  publishEvent,
  regenerateCalendarFeed,
} from "@horaya/core";
import { eq } from "drizzle-orm";
import { afterAll, describe, expect, it } from "vitest";
import { findCalendarFeedByToken, listCalendarFeedEvents } from "../src/queries";
import { member as memberTable } from "../src/schema";
import { contact, createMember, createOrganization, customerActor, db, testDeps } from "./helpers";

afterAll(() => db.$client.end());

const range = { from: new Date("2026-09-01T00:00:00Z"), to: new Date("2027-10-01T00:00:00Z") };

describe("abonnement d'agenda personnel", () => {
  it("crée l'adresse à la première demande, la garde ensuite, et coupe l'ancienne quand on la régénère", async () => {
    const organizationId = await createOrganization();
    const viewer = await createMember(organizationId, "viewer");
    const deps = testDeps();

    const first = await getCalendarFeed(deps, viewer);
    expect(first.token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect((await getCalendarFeed(deps, viewer)).token).toBe(first.token);
    expect(await findCalendarFeedByToken(db, first.token)).toMatchObject({ organizationId });

    const renewed = await regenerateCalendarFeed(deps, viewer);
    expect(renewed.id).toBe(first.id);
    expect(renewed.token).not.toBe(first.token);
    expect(await findCalendarFeedByToken(db, first.token)).toBeNull();
    expect(await findCalendarFeedByToken(db, renewed.token)).not.toBeNull();
  });

  it("donne un flux introuvable quand le membre quitte l'espace", async () => {
    const organizationId = await createOrganization();
    const editor = await createMember(organizationId, "editor");
    const { token } = await getCalendarFeed(testDeps(), editor);
    if (editor.type !== "member") throw new Error("membre attendu");
    await db.delete(memberTable).where(eq(memberTable.id, editor.memberId));
    expect(await findCalendarFeedByToken(db, token)).toBeNull();
  });

  it("liste les événements publiés et annulés, sans brouillon ni donnée de client", async () => {
    const organizationId = await createOrganization();
    const owner = await createMember(organizationId);
    const deps = testDeps();
    const type = await createEventType(deps, owner, { name: "Atelier", color: "#D8BC66" });
    const create = async (title: string) => {
      const [created] = await createEvent(deps, owner, {
        eventTypeId: type.id,
        title,
        startsAt: "2026-11-10T09:00:00Z",
        endsAt: "2026-11-10T12:00:00Z",
        timezone: "Europe/Paris",
        capacity: 10,
      });
      if (!created) throw new Error("Événement non créé");
      return created;
    };
    const open = await publishEvent(deps, owner, (await create("Atelier ouvert")).id);
    await create("Atelier en brouillon");
    const cancelled = await publishEvent(deps, owner, (await create("Atelier annulé")).id);
    await cancelEvent(deps, owner, cancelled.id);
    await createEventBooking(deps, customerActor(organizationId), {
      eventId: open.id,
      seats: 2,
      customer: contact(),
    });

    const events = await listCalendarFeedEvents(db, organizationId, range);
    const rows = events.map((entry) => [entry.title, entry.status, entry.seatsHeld]);
    expect(rows.sort()).toEqual([
      ["Atelier annulé", "cancelled", 0],
      ["Atelier ouvert", "published", 2],
    ]);
    const serialized = JSON.stringify(events);
    expect(serialized).not.toContain("Camille");
    expect(serialized).not.toContain("camille.roux@mail.com");
  });
});
