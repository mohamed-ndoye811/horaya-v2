import { type Actor, createStarterContent, type Deps } from "@horaya/core";
import { and, eq, isNull } from "drizzle-orm";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { event, item, itemAllocation } from "../src/schema";
import { createMember, createOrganization, db, fixedClock, testDeps } from "./helpers";

afterAll(() => db.$client.end());

let organizationId: string;
let owner: Actor;
let deps: Deps;

beforeEach(async () => {
  organizationId = await createOrganization();
  owner = await createMember(organizationId);
  deps = testDeps(fixedClock());
});

describe("contenu de départ d'un espace", () => {
  it("prépare une séance exemple en brouillon avec son matériel", async () => {
    const { eventId } = await createStarterContent(deps, owner, "wellness", "Europe/Paris");
    const [created] = await db
      .select()
      .from(event)
      .where(eq(event.id, eventId ?? ""));
    expect(created).toMatchObject({
      title: "Cours d'essai (exemple)",
      status: "draft",
      capacity: 8,
      priceCents: 4500,
      paymentMode: "on_site",
      // L'horloge des tests est au jeudi 1er octobre 2026 : samedi 3 à 10 h.
      startsAt: new Date("2026-10-03T08:00:00Z"),
    });
    const items = await db.select().from(item).where(eq(item.organizationId, organizationId));
    expect(items.map((entry) => entry.name)).toEqual(["Équipement prêté"]);
    const allocated = await db
      .select()
      .from(itemAllocation)
      .where(and(eq(itemAllocation.eventId, eventId ?? ""), isNull(itemAllocation.cancelledAt)));
    expect(allocated).toHaveLength(8);
  });

  it("s'en tient à la séance quand le secteur ne prête pas de matériel", async () => {
    await createStarterContent(deps, owner, "consulting", "Europe/Paris");
    expect(
      await db.select().from(item).where(eq(item.organizationId, organizationId)),
    ).toHaveLength(0);
  });
});
