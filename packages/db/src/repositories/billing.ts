import type { BillingAccount, BillingRepository, PlanGrant } from "@horaya/core";
import { and, count, eq, gte, lt, ne } from "drizzle-orm";
import type { Executor } from "../client";
import { billing, booking, invitation, member, planGrant } from "../schema";

type BillingRow = typeof billing.$inferSelect;

function toAccount(organizationId: string, row: BillingRow | undefined): BillingAccount {
  if (!row) return { organizationId, rate: "standard", subscription: null };
  const subscribed =
    row.plan && row.interval && row.status && row.polarCustomerId && row.polarSubscriptionId;
  return {
    organizationId,
    rate: row.rate,
    subscription: subscribed
      ? {
          plan: row.plan as NonNullable<BillingRow["plan"]>,
          interval: row.interval as NonNullable<BillingRow["interval"]>,
          status: row.status as NonNullable<BillingRow["status"]>,
          polarCustomerId: row.polarCustomerId as string,
          polarSubscriptionId: row.polarSubscriptionId as string,
          currentPeriodEnd: row.currentPeriodEnd,
          cancelAtPeriodEnd: row.cancelAtPeriodEnd,
        }
      : null,
  };
}

export function billingRepository(db: Executor): BillingRepository {
  return {
    async get(organizationId) {
      const [row] = await db
        .select()
        .from(billing)
        .where(eq(billing.organizationId, organizationId));
      return toAccount(organizationId, row);
    },

    async findByPolarCustomer(polarCustomerId) {
      const [row] = await db
        .select({ organizationId: billing.organizationId })
        .from(billing)
        .where(eq(billing.polarCustomerId, polarCustomerId));
      return row?.organizationId ?? null;
    },

    async saveSubscription(organizationId, subscription) {
      const values = { organizationId, ...subscription };
      await db
        .insert(billing)
        .values(values)
        .onConflictDoUpdate({
          target: billing.organizationId,
          set: { ...subscription, updatedAt: new Date() },
        });
    },

    async setRate(organizationId, rate) {
      await db
        .insert(billing)
        .values({ organizationId, rate })
        .onConflictDoUpdate({
          target: billing.organizationId,
          set: { rate, updatedAt: new Date() },
        });
    },

    async listGrants(organizationId) {
      return (await db
        .select()
        .from(planGrant)
        .where(eq(planGrant.organizationId, organizationId))
        .orderBy(planGrant.createdAt)) satisfies PlanGrant[];
    },

    async addGrant(grant) {
      const [saved] = await db.insert(planGrant).values(grant).returning();
      if (!saved) throw new Error("Licence non enregistrée");
      return saved;
    },

    async revokeGrant(organizationId, grantId, at) {
      const revoked = await db
        .update(planGrant)
        .set({ revokedAt: at })
        .where(and(eq(planGrant.organizationId, organizationId), eq(planGrant.id, grantId)))
        .returning({ id: planGrant.id });
      return revoked.length > 0;
    },

    async countSeats(organizationId) {
      const [members] = await db
        .select({ value: count() })
        .from(member)
        .where(eq(member.organizationId, organizationId));
      const [pending] = await db
        .select({ value: count() })
        .from(invitation)
        .where(
          and(eq(invitation.organizationId, organizationId), eq(invitation.status, "pending")),
        );
      return (members?.value ?? 0) + (pending?.value ?? 0);
    },

    async countBookings(organizationId, from, to) {
      const [row] = await db
        .select({ value: count() })
        .from(booking)
        .where(
          and(
            eq(booking.organizationId, organizationId),
            ne(booking.status, "refused"),
            gte(booking.createdAt, from),
            lt(booking.createdAt, to),
          ),
        );
      return row?.value ?? 0;
    },
  };
}
