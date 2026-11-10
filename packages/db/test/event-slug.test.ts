import {
  type Actor,
  createEvent,
  createEventType,
  type Deps,
  publishEvent,
  updateEvent,
} from "@horaya/core";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { createMember, createOrganization, db, fixedClock, testDeps } from "./helpers";

afterAll(() => db.$client.end());

let owner: Actor;
let deps: Deps;

beforeEach(async () => {
  owner = await createMember(await createOrganization());
  deps = testDeps(fixedClock());
});

async function draft(title: string) {
  const type = await createEventType(deps, owner, { name: "Cours", color: "#528D74" });
  const [created] = await createEvent(deps, owner, {
    eventTypeId: type.id,
    title,
    startsAt: "2026-11-10T09:00:00Z",
    endsAt: "2026-11-10T11:00:00Z",
    timezone: "Europe/Paris",
  });
  if (!created) throw new Error("événement");
  return created;
}

describe("adresse publique d'un événement", () => {
  it("suit le titre tant que l'événement est en brouillon", async () => {
    const event = await draft("Cours de surf débutant (brouillon)");
    const renamed = await updateEvent(deps, owner, event.id, { title: "Cours de surf débutant" });
    expect(renamed.slug).toBe("cours-de-surf-debutant");
  });

  it("ne bouge plus une fois publié (le lien a pu être partagé)", async () => {
    const event = await draft("Cours de surf");
    await publishEvent(deps, owner, event.id);
    const renamed = await updateEvent(deps, owner, event.id, { title: "Cours de surf du matin" });
    expect(renamed.slug).toBe("cours-de-surf");
  });
});
