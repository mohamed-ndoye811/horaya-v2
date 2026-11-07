import { and, count, desc, eq, gte, ilike, inArray, or, sql } from "drizzle-orm";
import type { Executor } from "../client";
import { activityLog, booking, event, invitation, member, organization, user } from "../schema";

/*
 * Cockpit de la plateforme (équipe Horaya) : lectures transverses à tous les espaces. Jamais
 * appelées depuis un écran d'espace ; l'accès est vérifié par l'app (PLATFORM_ADMINS).
 */

/** Chiffres d'ensemble : espaces, comptes, réservations depuis `since`. */
export async function platformStats(db: Executor, since: Date) {
  const [[workspaces], [newWorkspaces], [users], [bookings]] = await Promise.all([
    db.select({ value: count() }).from(organization),
    db.select({ value: count() }).from(organization).where(gte(organization.createdAt, since)),
    db.select({ value: count() }).from(user),
    db.select({ value: count() }).from(booking).where(gte(booking.createdAt, since)),
  ]);
  return {
    workspaces: workspaces?.value ?? 0,
    newWorkspaces: newWorkspaces?.value ?? 0,
    users: users?.value ?? 0,
    bookings: bookings?.value ?? 0,
  };
}

const like = (q: string) => `%${q.replace(/[%_\\]/g, (char) => `\\${char}`)}%`;

/** Espaces, les plus récents d'abord, avec leur propriétaire et leur activité. */
export async function listPlatformWorkspaces(db: Executor, query: string | undefined, since: Date) {
  const owner = db
    .select({ organizationId: member.organizationId, name: user.name, email: user.email })
    .from(member)
    .innerJoin(user, eq(user.id, member.userId))
    .where(eq(member.role, "owner"))
    .as("owner");
  const rows = await db
    .select({
      id: organization.id,
      name: organization.name,
      slug: organization.slug,
      createdAt: organization.createdAt,
      ownerName: owner.name,
      ownerEmail: owner.email,
    })
    .from(organization)
    .leftJoin(owner, eq(owner.organizationId, organization.id))
    .where(
      query
        ? or(
            ilike(organization.name, like(query)),
            ilike(organization.slug, like(query)),
            ilike(owner.email, like(query)),
          )
        : undefined,
    )
    .orderBy(desc(organization.createdAt))
    .limit(200);
  const ids = rows.map((row) => row.id);
  if (ids.length === 0) return [];
  const [members, bookings] = await Promise.all([
    db
      .select({ id: member.organizationId, value: count() })
      .from(member)
      .where(inArray(member.organizationId, ids))
      .groupBy(member.organizationId),
    db
      .select({ id: booking.organizationId, value: count() })
      .from(booking)
      .where(and(inArray(booking.organizationId, ids), gte(booking.createdAt, since)))
      .groupBy(booking.organizationId),
  ]);
  const byId = (list: Array<{ id: string; value: number }>) =>
    new Map(list.map((entry) => [entry.id, entry.value]));
  const memberCount = byId(members);
  const bookingCount = byId(bookings);
  return rows.map((row) => ({
    ...row,
    members: memberCount.get(row.id) ?? 0,
    recentBookings: bookingCount.get(row.id) ?? 0,
  }));
}

/** Fiche d'un espace : équipe, volumes, journal de facturation. */
export async function getPlatformWorkspace(db: Executor, organizationId: string) {
  const [found] = await db.select().from(organization).where(eq(organization.id, organizationId));
  if (!found) return null;
  const [team, [pending], [events], [bookings], history] = await Promise.all([
    db
      .select({
        id: member.id,
        role: member.role,
        joinedAt: member.createdAt,
        name: user.name,
        email: user.email,
      })
      .from(member)
      .innerJoin(user, eq(user.id, member.userId))
      .where(eq(member.organizationId, organizationId))
      .orderBy(member.createdAt),
    db
      .select({ value: count() })
      .from(invitation)
      .where(and(eq(invitation.organizationId, organizationId), eq(invitation.status, "pending"))),
    db.select({ value: count() }).from(event).where(eq(event.organizationId, organizationId)),
    db.select({ value: count() }).from(booking).where(eq(booking.organizationId, organizationId)),
    db
      .select({
        id: activityLog.id,
        action: activityLog.action,
        data: activityLog.data,
        createdAt: activityLog.createdAt,
      })
      .from(activityLog)
      .where(
        and(eq(activityLog.organizationId, organizationId), eq(activityLog.entityType, "billing")),
      )
      .orderBy(desc(activityLog.createdAt))
      .limit(20),
  ]);
  return {
    workspace: { id: found.id, name: found.name, slug: found.slug, createdAt: found.createdAt },
    team,
    pendingInvitations: pending?.value ?? 0,
    events: events?.value ?? 0,
    bookings: bookings?.value ?? 0,
    history,
  };
}

/** Comptes, les plus récents d'abord, avec leurs espaces. */
export async function listPlatformUsers(db: Executor, query: string | undefined) {
  const rows = await db
    .select({
      id: user.id,
      name: user.name,
      email: user.email,
      emailVerified: user.emailVerified,
      createdAt: user.createdAt,
      workspaces: sql<
        Array<{ id: string; name: string; role: string }>
      >`coalesce(json_agg(json_build_object('id', ${organization.id}, 'name', ${organization.name}, 'role', ${member.role})) filter (where ${organization.id} is not null), '[]')`,
    })
    .from(user)
    .leftJoin(member, eq(member.userId, user.id))
    .leftJoin(organization, eq(organization.id, member.organizationId))
    .where(query ? or(ilike(user.name, like(query)), ilike(user.email, like(query))) : undefined)
    .groupBy(user.id)
    .orderBy(desc(user.createdAt))
    .limit(200);
  return rows;
}
