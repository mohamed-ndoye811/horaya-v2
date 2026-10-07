import {
  type ActivityEntry,
  type Actor,
  cancelBooking,
  createEvent,
  createEventBooking,
  createEventType,
  type Deps,
  hashToken,
  publishEvent,
  reissueManageLinks,
} from "@horaya/core";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { getManagedBooking, getPublicEvent, listPublicEvents } from "../src/queries";
import { createUnitOfWork } from "../src/unit-of-work";
import {
  contact,
  createOrganization,
  customerActor,
  db,
  fixedClock,
  member,
  testDeps,
} from "./helpers";

afterAll(() => db.$client.end());

let organizationId: string;
let owner: Actor;
let deps: Deps;

beforeEach(async () => {
  organizationId = await createOrganization();
  owner = member(organizationId);
  deps = testDeps();
});

async function event(
  title: string,
  day: number,
  options: { capacity?: number; publish?: boolean; visibility?: "public" | "invite_only" } = {},
) {
  const type = await createEventType(deps, owner, { name: `Type ${title}`, color: "#528D74" });
  const [created] = await createEvent(deps, owner, {
    eventTypeId: type.id,
    title,
    startsAt: `2026-10-${String(day).padStart(2, "0")}T08:00:00Z`,
    endsAt: `2026-10-${String(day).padStart(2, "0")}T12:00:00Z`,
    timezone: "Europe/Paris",
    capacity: options.capacity ?? 10,
    visibility: options.visibility ?? "public",
    highlights: ["Déjeuner inclus"],
  });
  if (!created) throw new Error("événement");
  return options.publish === false ? created : publishEvent(deps, owner, created.id);
}

describe("pages publiques", () => {
  it("ne montre que les événements publiés, publics et à venir, avec leurs places prises", async () => {
    const open = await event("Atelier ouvert", 10);
    await event("Brouillon", 11, { publish: false });
    await event("Sur invitation", 12, { visibility: "invite_only" });
    await createEventBooking(deps, customerActor(organizationId), {
      eventId: open.id,
      seats: 3,
      customer: contact(),
    });

    const listed = await listPublicEvents(db, organizationId, new Date("2026-10-01T00:00:00Z"));
    expect(listed.map((entry) => entry.title)).toEqual(["Atelier ouvert"]);
    expect(listed[0]).toMatchObject({ seatsHeld: 3, highlights: ["Déjeuner inclus"] });
    expect(await getPublicEvent(db, organizationId, open.slug)).toMatchObject({
      title: "Atelier ouvert",
      customFields: [],
    });
  });

  it("retrouve une réservation par son jeton et en réémet de nouveaux", async () => {
    const open = await event("Atelier", 10);
    const { manageToken } = await createEventBooking(deps, customerActor(organizationId), {
      eventId: open.id,
      seats: 2,
      customer: contact(),
      participants: [{ firstName: "Camille", lastName: "Roux" }],
    });
    const found = await getManagedBooking(db, organizationId, await hashToken(manageToken));
    expect(found).toMatchObject({
      seats: 2,
      eventTitle: "Atelier",
      participants: [{ firstName: "Camille", lastName: "Roux" }],
    });

    const links = await reissueManageLinks(deps, organizationId, "CAMILLE.ROUX@mail.com");
    expect(links).toHaveLength(1);
    expect(await getManagedBooking(db, organizationId, await hashToken(manageToken))).toBeNull();
    expect(
      await getManagedBooking(db, organizationId, await hashToken(links[0]?.manageToken ?? "")),
    ).not.toBeNull();
    expect(await reissueManageLinks(deps, organizationId, "inconnu@mail.com")).toEqual([]);
  });
});

describe("après la transaction", () => {
  it("transmet le journal d'activité une fois validé, et rien si la transaction échoue", async () => {
    const seen: ActivityEntry[][] = [];
    const hooked: Deps = {
      uow: createUnitOfWork(db, { afterCommit: (entries) => void seen.push(entries) }),
      clock: fixedClock(),
    };
    const open = await event("Atelier", 10, { capacity: 1 });
    const { booking } = await createEventBooking(hooked, customerActor(organizationId), {
      eventId: open.id,
      seats: 1,
      customer: contact(),
    });
    await cancelBooking(hooked, owner, booking.id, "Doublon");
    expect(seen.map((entries) => entries.map((entry) => entry.action))).toEqual([
      ["booking.created"],
      ["booking.cancelled"],
    ]);
    expect(seen[1]?.[0]?.data).toEqual({ reason: "Doublon" });

    await expect(cancelBooking(hooked, owner, booking.id)).rejects.toThrow();
    expect(seen).toHaveLength(2);
  });
});
