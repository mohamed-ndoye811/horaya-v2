import type { Pass, PassMovement, PassPlan, PassRepository } from "@horaya/core";
import { and, eq, sql } from "drizzle-orm";
import type { Executor } from "../client";
import { pass, passMovement, passPlan } from "../schema";

export function passRepository(db: Executor): PassRepository {
  const one = <T>(rows: T[], what: string): T => {
    const [row] = rows;
    if (!row) throw new Error(`${what} introuvable`);
    return row;
  };
  return {
    async insertPlan(organizationId, data) {
      const rows = await db
        .insert(passPlan)
        .values({ organizationId, ...data })
        .returning();
      return one(rows, "Formule") as PassPlan;
    },

    async updatePlan(organizationId, planId, patch) {
      const rows = await db
        .update(passPlan)
        .set(patch)
        .where(and(eq(passPlan.organizationId, organizationId), eq(passPlan.id, planId)))
        .returning();
      return one(rows, "Formule") as PassPlan;
    },

    async findPlan(organizationId, planId) {
      const [found] = await db
        .select()
        .from(passPlan)
        .where(and(eq(passPlan.organizationId, organizationId), eq(passPlan.id, planId)));
      return (found as PassPlan | undefined) ?? null;
    },

    async insert(values) {
      return one(await db.insert(pass).values(values).returning(), "Carte") as Pass;
    },

    async find(organizationId, passId) {
      const [found] = await db
        .select()
        .from(pass)
        .where(and(eq(pass.organizationId, organizationId), eq(pass.id, passId)));
      return (found as Pass | undefined) ?? null;
    },

    async lock(organizationId, passId) {
      const [found] = await db
        .select()
        .from(pass)
        .where(and(eq(pass.organizationId, organizationId), eq(pass.id, passId)))
        .for("update");
      return (found as Pass | undefined) ?? null;
    },

    async update(organizationId, passId, patch) {
      const rows = await db
        .update(pass)
        .set(patch)
        .where(and(eq(pass.organizationId, organizationId), eq(pass.id, passId)))
        .returning();
      return one(rows, "Carte") as Pass;
    },

    async insertMovement(movement) {
      return one(
        await db.insert(passMovement).values(movement).returning(),
        "Mouvement",
      ) as PassMovement;
    },

    async balance(passId) {
      const [row] = await db
        .select({ total: sql<number>`coalesce(sum(${passMovement.delta}), 0)::int` })
        .from(passMovement)
        .where(eq(passMovement.passId, passId));
      return row?.total ?? 0;
    },

    async findMovementForBooking(bookingId, kind) {
      const [found] = await db
        .select()
        .from(passMovement)
        .where(and(eq(passMovement.bookingId, bookingId), eq(passMovement.kind, kind)));
      return (found as PassMovement | undefined) ?? null;
    },
  };
}
