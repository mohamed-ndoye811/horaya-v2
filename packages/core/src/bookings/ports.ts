import type { Customer, CustomerNote } from "../customers/model";
import type { ActorType } from "../tenants/types";
import type { Booking, CustomerContact, ParticipantInput } from "./model";
import type { BookingPaymentStatus, BookingStatus } from "./types";

export type NewBooking = Omit<
  Booking,
  | "id"
  | "createdAt"
  | "updatedAt"
  | "cancelledAt"
  | "checkedInAt"
  | "refusalReason"
  | "paymentStatus"
  | "rentalStartsAt"
  | "rentalEndsAt"
> & { manageTokenHash: string; rentalStartsAt?: Date | null; rentalEndsAt?: Date | null };

export interface BookingStatusChange {
  status: BookingStatus;
  confirmedAt?: Date | null;
  cancelledAt?: Date | null;
  refusalReason?: string | null;
}

export interface BookingRepository {
  /** Places occupées sur un événement (réservations en attente + confirmées). */
  seatsHeld(eventId: string): Promise<number>;
  insert(booking: NewBooking, participants: ParticipantInput[]): Promise<Booking>;
  find(organizationId: string, bookingId: string): Promise<Booking | null>;
  findByManageTokenHash(organizationId: string, tokenHash: string): Promise<Booking | null>;
  updateStatus(
    organizationId: string,
    bookingId: string,
    change: BookingStatusChange,
  ): Promise<Booking>;
  /** Liste d'attente d'un événement, la plus ancienne demande d'abord. */
  listWaitlisted(eventId: string): Promise<Booking[]>;
  /** Réservations encore actives (en attente, confirmées, en liste d'attente). */
  listActive(eventId: string): Promise<Booking[]>;
  /** Réservations actives et pas encore terminées d'un client, retrouvé par son e-mail. */
  listUpcomingForCustomerEmail(
    organizationId: string,
    email: string,
    now: Date,
  ): Promise<Booking[]>;
  updatePaymentStatus(
    organizationId: string,
    bookingId: string,
    status: BookingPaymentStatus,
  ): Promise<void>;
  /** Pointe l'arrivée (date) ou l'annule (null). */
  setCheckedIn(organizationId: string, bookingId: string, at: Date | null): Promise<Booking>;
  /** Remplace le jeton du lien « Gérer ma réservation » (l'ancien lien cesse de marcher). */
  setManageTokenHash(organizationId: string, bookingId: string, tokenHash: string): Promise<void>;
}

export interface CustomerRepository {
  /** Retrouve le client par e-mail (insensible à la casse) ou le crée. */
  upsertByEmail(organizationId: string, contact: CustomerContact): Promise<{ id: string }>;
  find(organizationId: string, customerId: string): Promise<Customer | null>;
  /** Lève une ConflictError si l'e-mail est déjà pris dans l'espace. */
  insert(organizationId: string, data: NewCustomer): Promise<Customer>;
  update(
    organizationId: string,
    customerId: string,
    patch: Partial<NewCustomer>,
  ): Promise<Customer>;
  insertNote(
    organizationId: string,
    note: { customerId: string; authorMemberId: string | null; body: string; pinned: boolean },
  ): Promise<CustomerNote>;
}

export type NewCustomer = Pick<
  Customer,
  "firstName" | "lastName" | "email" | "phone" | "company" | "tags" | "marketingConsent"
>;

export interface ReferenceCounter {
  /** Incrémente atomiquement le compteur (tenant, portée, période) et renvoie la nouvelle valeur. */
  next(organizationId: string, scope: string, period: string): Promise<number>;
}

export interface ActivityEntry {
  organizationId: string;
  entityType:
    | "booking"
    | "event"
    | "event_type"
    | "customer"
    | "item"
    | "settings"
    | "calendar_link";
  entityId: string;
  action: string;
  actorType: ActorType;
  actorId: string | null;
  data?: Record<string, unknown>;
}

export interface ActivityLog {
  record(entry: ActivityEntry): Promise<void>;
}
