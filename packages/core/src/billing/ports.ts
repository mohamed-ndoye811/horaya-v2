import type { BillingAccount, PlanGrant, Subscription } from "./model";
import type { BillingRate, PlanGrantKind, PlanId } from "./plans";

export interface BillingRepository {
  /** Compte de l'espace ; tarif standard et sans abonnement s'il n'a jamais été créé. */
  get(organizationId: string): Promise<BillingAccount>;
  findByPolarCustomer(polarCustomerId: string): Promise<string | null>;
  saveSubscription(organizationId: string, subscription: Subscription): Promise<void>;
  setRate(organizationId: string, rate: BillingRate): Promise<void>;
  listGrants(organizationId: string): Promise<PlanGrant[]>;
  addGrant(grant: {
    organizationId: string;
    kind: PlanGrantKind;
    plan: PlanId;
    reason: string | null;
    expiresAt: Date | null;
  }): Promise<PlanGrant>;
  revokeGrant(organizationId: string, grantId: string, at: Date): Promise<boolean>;
  /** Membres et invitations en attente. */
  countSeats(organizationId: string): Promise<number>;
  /** Réservations reçues (hors refusées) créées dans [from, to). */
  countBookings(organizationId: string, from: Date, to: Date): Promise<number>;
}
