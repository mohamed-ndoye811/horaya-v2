import type { Period } from "../inventory/availability";
import type { TakenSlot } from "../modules/time";

/** Créneau gardé 10 minutes pendant que l'élève remplit le formulaire (lot 37). */
export interface SlotHold {
  id: string;
  organizationId: string;
  eventTypeId: string;
  startsAt: Date;
  endsAt: Date;
  durationId: string | null;
  staffMemberId: string | null;
  /** Créneau déjà réservé que l'élève vient compléter (null : nouveau créneau). */
  eventId: string | null;
  seats: number;
  expiresAt: Date;
}

export type NewSlotHold = Omit<SlotHold, "id">;

export interface SlotRepository {
  /**
   * Verrou de transaction (pg_advisory_xact_lock) sur les créneaux de l'espace : deux
   * réservations ou mises de côté passent l'une après l'autre, jamais en même temps.
   */
  lock(organizationId: string): Promise<void>;
  /** Créneaux du type réservés (événements) ou gardés (non expirés) sur la période. */
  taken(
    organizationId: string,
    eventTypeId: string,
    period: Period,
    now: Date,
    exceptHoldId?: string,
  ): Promise<TakenSlot[]>;
  /** Ce qui occupe les intervenants sur la période : leurs événements et créneaux gardés. */
  staffBusy(
    organizationId: string,
    memberIds: readonly string[],
    period: Period,
    now: Date,
    exceptHoldId?: string,
  ): Promise<Record<string, Period[]>>;
  insertHold(hold: NewSlotHold): Promise<SlotHold>;
  findHold(organizationId: string, holdId: string): Promise<SlotHold | null>;
  deleteHold(organizationId: string, holdId: string): Promise<void>;
  /** Supprime les créneaux gardés expirés de l'espace. */
  deleteExpiredHolds(organizationId: string, now: Date): Promise<number>;
}
