import { randomUUID } from "node:crypto";
import type { Actor, Clock, Deps } from "@horaya/core";
import { createDb } from "../src/client";
import { member as memberTable, organization, tenantSettings, user } from "../src/schema";
import { createUnitOfWork } from "../src/unit-of-work";

export const db = createDb(process.env.TEST_DATABASE_URL ?? "");

/** Horloge réglable : les tests se placent au 1er octobre 2026. */
export function fixedClock(
  initial = new Date("2026-10-01T08:00:00Z"),
): Clock & { set(date: Date): void } {
  let current = initial;
  return {
    now: () => current,
    set: (date) => {
      current = date;
    },
  };
}

export function testDeps(clock: Clock = fixedClock()): Deps {
  return { uow: createUnitOfWork(db), clock };
}

export async function createOrganization(prefix = "VID") {
  const organizationId = randomUUID();
  await db.insert(organization).values({
    id: organizationId,
    name: "Cabinet Vidal",
    slug: `cabinet-vidal-${organizationId.slice(0, 8)}`,
    createdAt: new Date(),
  });
  await db.insert(tenantSettings).values({ organizationId, bookingReferencePrefix: prefix });
  return organizationId;
}

export function member(
  organizationId: string,
  role: "owner" | "admin" | "editor" | "viewer" = "owner",
): Actor {
  return { type: "member", organizationId, userId: randomUUID(), memberId: randomUUID(), role };
}

export const customerActor = (organizationId: string): Actor => ({
  type: "customer",
  organizationId,
});

export const contact = (email = "camille.roux@mail.com") => ({
  firstName: "Camille",
  lastName: "Roux",
  email,
});

/** Membre réel (utilisateur + adhésion en base), pour les tables qui le référencent. */
export async function createMember(
  organizationId: string,
  role: "owner" | "admin" | "editor" | "viewer" = "owner",
): Promise<Actor> {
  const userId = randomUUID();
  const memberId = randomUUID();
  await db.insert(user).values({
    id: userId,
    name: "Mohamed Ndoye",
    email: `membre-${userId.slice(0, 8)}@test.dev`,
    emailVerified: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
  await db
    .insert(memberTable)
    .values({ id: memberId, organizationId, userId, role, createdAt: new Date() });
  return { type: "member", organizationId, userId, memberId, role };
}
