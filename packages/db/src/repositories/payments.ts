import type { PaymentRecord, PaymentRepository } from "@horaya/core";
import { and, asc, eq } from "drizzle-orm";
import type { Executor } from "../client";
import { payment } from "../schema";

export function paymentRepository(db: Executor): PaymentRepository {
  return {
    async insert(record) {
      const [created] = await db.insert(payment).values(record).returning();
      if (!created) throw new Error("Paiement non enregistré");
      return created as PaymentRecord;
    },

    async findByCheckout(provider, checkoutReference) {
      const [found] = await db
        .select()
        .from(payment)
        .where(
          and(eq(payment.provider, provider), eq(payment.checkoutReference, checkoutReference)),
        );
      return (found as PaymentRecord | undefined) ?? null;
    },

    async markSucceeded(paymentId, providerReference) {
      const [updated] = await db
        .update(payment)
        .set({ status: "succeeded", providerReference })
        .where(eq(payment.id, paymentId))
        .returning();
      if (!updated) throw new Error("Paiement introuvable");
      return updated as PaymentRecord;
    },

    async markFailed(paymentId) {
      await db.update(payment).set({ status: "failed" }).where(eq(payment.id, paymentId));
    },

    async listForBooking(bookingId) {
      const rows = await db
        .select()
        .from(payment)
        .where(eq(payment.bookingId, bookingId))
        .orderBy(asc(payment.createdAt));
      return rows as PaymentRecord[];
    },
  };
}
