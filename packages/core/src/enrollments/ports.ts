import type { Booking } from "../bookings/model";
import type { Enrollment } from "./model";

export type NewEnrollment = Omit<Enrollment, "id" | "createdAt" | "cancelledAt"> & {
  /** Empreinte du jeton du lien de gestion de l'inscription. */
  manageTokenHash: string;
};

export interface EnrollmentRepository {
  insert(enrollment: NewEnrollment): Promise<Enrollment>;
  find(organizationId: string, enrollmentId: string): Promise<Enrollment | null>;
  findByManageTokenHash(organizationId: string, tokenHash: string): Promise<Enrollment | null>;
  /** Inscription en cours (non annulée) d'un client à une série. */
  findActive(
    organizationId: string,
    seriesId: string,
    customerId: string,
  ): Promise<Enrollment | null>;
  update(
    organizationId: string,
    enrollmentId: string,
    patch: Partial<Pick<Enrollment, "paidAt" | "cancelledAt">>,
  ): Promise<Enrollment>;
  /** Réservations des séances de l'inscription, tous statuts. */
  listBookings(enrollmentId: string): Promise<Booking[]>;
  /** Séance de rattrapage encore active (en attente ou confirmée) d'une absence. */
  findActiveMakeup(absentBookingId: string): Promise<Booking | null>;
}
