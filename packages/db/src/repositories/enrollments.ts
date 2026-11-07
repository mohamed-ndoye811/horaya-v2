import type { Booking, Enrollment, EnrollmentRepository } from "@horaya/core";
import { and, asc, eq, getTableColumns, isNull } from "drizzle-orm";
import type { Executor } from "../client";
import { booking, seriesEnrollment } from "../schema";

/** Colonnes exposées au core (le hash du jeton reste en base). */
const { manageTokenHash: _hidden, updatedAt: _updated, ...columns } =
  getTableColumns(seriesEnrollment);
const { manageTokenHash: _bookingHash, ...bookingColumns } = getTableColumns(booking);

export function enrollmentRepository(db: Executor): EnrollmentRepository {
  const select = () => db.select(columns).from(seriesEnrollment);
  const inOrganization = (organizationId: string) =>
    eq(seriesEnrollment.organizationId, organizationId);

  return {
    async insert(values) {
      const [created] = await db.insert(seriesEnrollment).values(values).returning(columns);
      if (!created) throw new Error("Inscription non créée");
      return created as Enrollment;
    },

    async find(organizationId, enrollmentId) {
      const [found] = await select().where(
        and(inOrganization(organizationId), eq(seriesEnrollment.id, enrollmentId)),
      );
      return (found as Enrollment | undefined) ?? null;
    },

    async findByManageTokenHash(organizationId, tokenHash) {
      const [found] = await select().where(
        and(inOrganization(organizationId), eq(seriesEnrollment.manageTokenHash, tokenHash)),
      );
      return (found as Enrollment | undefined) ?? null;
    },

    async findActive(organizationId, seriesId, customerId) {
      const [found] = await select().where(
        and(
          inOrganization(organizationId),
          eq(seriesEnrollment.seriesId, seriesId),
          eq(seriesEnrollment.customerId, customerId),
          isNull(seriesEnrollment.cancelledAt),
        ),
      );
      return (found as Enrollment | undefined) ?? null;
    },

    async update(organizationId, enrollmentId, patch) {
      const [updated] = await db
        .update(seriesEnrollment)
        .set(patch)
        .where(and(inOrganization(organizationId), eq(seriesEnrollment.id, enrollmentId)))
        .returning(columns);
      if (!updated) throw new Error(`Inscription introuvable : ${enrollmentId}`);
      return updated as Enrollment;
    },

    async listBookings(enrollmentId) {
      const rows = await db
        .select(bookingColumns)
        .from(booking)
        .where(eq(booking.enrollmentId, enrollmentId))
        .orderBy(asc(booking.createdAt), asc(booking.id));
      return rows as Booking[];
    },
  };
}
