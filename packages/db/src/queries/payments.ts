import { and, asc, eq, gte, sql } from "drizzle-orm";
import type { Executor } from "../client";
import { booking, customer, event, organization, payment, tenantSettings } from "../schema";

/** Mouvements d'argent d'une réservation (fiche réservation, page « Gérer ma réservation »). */
export async function listBookingPayments(db: Executor, bookingId: string) {
  return db
    .select({
      id: payment.id,
      kind: payment.kind,
      status: payment.status,
      amountCents: payment.amountCents,
      provider: payment.provider,
      createdAt: payment.createdAt,
    })
    .from(payment)
    .where(eq(payment.bookingId, bookingId))
    .orderBy(asc(payment.createdAt));
}

/** Page de paiement simulée (passerelle de test) : ce qu'elle affiche. */
export async function getCheckoutSummary(
  db: Executor,
  provider: string,
  checkoutReference: string,
) {
  const [row] = await db
    .select({
      paymentId: payment.id,
      status: payment.status,
      amountCents: payment.amountCents,
      kind: payment.kind,
      organizationName: organization.name,
      brandColor: sql<string>`coalesce(${tenantSettings.brandColor}, '#264489')`,
      reference: booking.reference,
      title: sql<string>`coalesce(${event.title}, 'Location de matériel')`,
      customerEmail: customer.email,
    })
    .from(payment)
    .innerJoin(booking, eq(booking.id, payment.bookingId))
    .innerJoin(customer, eq(customer.id, booking.customerId))
    .innerJoin(organization, eq(organization.id, payment.organizationId))
    .leftJoin(tenantSettings, eq(tenantSettings.organizationId, payment.organizationId))
    .leftJoin(event, eq(event.id, booking.eventId))
    .where(and(eq(payment.provider, provider), eq(payment.checkoutReference, checkoutReference)));
  return row ?? null;
}

/** Espace d'un compte de paiement (webhook « account.updated »). */
export async function findOrganizationByPaymentAccount(
  db: Executor,
  accountId: string,
): Promise<string | null> {
  const [row] = await db
    .select({ id: tenantSettings.organizationId })
    .from(tenantSettings)
    .where(eq(tenantSettings.stripeAccountId, accountId));
  return row?.id ?? null;
}

/** Encaissé en ligne depuis une date, remboursements déduits (écran 26). */
export async function sumCollectedSince(
  db: Executor,
  organizationId: string,
  since: Date,
): Promise<number> {
  const [row] = await db
    .select({
      value: sql<number>`coalesce(sum(case when ${payment.kind} = 'refund' then -${payment.amountCents} else ${payment.amountCents} end), 0)::int`,
    })
    .from(payment)
    .where(
      and(
        eq(payment.organizationId, organizationId),
        eq(payment.status, "succeeded"),
        gte(payment.createdAt, since),
      ),
    );
  return row?.value ?? 0;
}
