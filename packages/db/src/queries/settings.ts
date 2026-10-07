import {
  MEMBER_ROLES,
  type MemberRole,
  NOTIFICATION_TYPES,
  type NotificationType,
} from "@horaya/core";
import { and, asc, eq, gt, gte, sql } from "drizzle-orm";
import type { Executor } from "../client";
import {
  event,
  invitation,
  member,
  notificationPreference,
  organization,
  tenantSettings,
  user,
} from "../schema";

const toRole = (role: string): MemberRole =>
  (MEMBER_ROLES as readonly string[]).includes(role) ? (role as MemberRole) : "viewer";

/** Organisation et réglages complets (écrans 24 et 26). */
export async function getWorkspaceSettings(db: Executor, organizationId: string) {
  const [row] = await db
    .select({
      name: organization.name,
      slug: organization.slug,
      logo: organization.logo,
      brandColor: sql<string>`coalesce(${tenantSettings.brandColor}, '#264489')`,
      displayFont: sql<string>`coalesce(${tenantSettings.displayFont}, 'display')`,
      description: tenantSettings.description,
      currency: sql<string>`coalesce(${tenantSettings.currency}, 'EUR')`,
      vatRateBps: sql<number>`coalesce(${tenantSettings.vatRateBps}, 2000)`,
      defaultDepositPercent: sql<number>`coalesce(${tenantSettings.defaultDepositPercent}, 30)`,
      freeCancellationHours: sql<number>`coalesce(${tenantSettings.freeCancellationHours}, 72)`,
      lateCancellationRefundPercent: sql<number>`coalesce(${tenantSettings.lateCancellationRefundPercent}, 50)`,
      stripeAccountStatus: sql<string>`coalesce(${tenantSettings.stripeAccountStatus}::text, 'not_connected')`,
    })
    .from(organization)
    .leftJoin(tenantSettings, eq(tenantSettings.organizationId, organization.id))
    .where(eq(organization.id, organizationId));
  return row ?? null;
}

/** Prochains événements visibles sur la page publique (aperçu de l'écran 24). */
export async function listPublicUpcomingEvents(
  db: Executor,
  organizationId: string,
  now: Date,
  limit = 3,
) {
  return db
    .select({
      id: event.id,
      title: event.title,
      startsAt: event.startsAt,
      priceCents: event.priceCents,
    })
    .from(event)
    .where(
      and(
        eq(event.organizationId, organizationId),
        eq(event.status, "published"),
        eq(event.visibility, "public"),
        gte(event.startsAt, now),
      ),
    )
    .orderBy(asc(event.startsAt))
    .limit(limit);
}

export interface TeamMemberRow {
  id: string;
  userId: string;
  name: string;
  email: string;
  role: MemberRole;
  joinedAt: Date;
}

export interface PendingInvitationRow {
  id: string;
  email: string;
  role: MemberRole;
  createdAt: Date;
  expiresAt: Date;
  inviterName: string | null;
}

/** Membres de l'espace et invitations en attente (écran 25). */
export async function listTeam(db: Executor, organizationId: string, now: Date) {
  const [members, invitations] = await Promise.all([
    db
      .select({
        id: member.id,
        userId: member.userId,
        name: user.name,
        email: user.email,
        role: member.role,
        joinedAt: member.createdAt,
      })
      .from(member)
      .innerJoin(user, eq(user.id, member.userId))
      .where(eq(member.organizationId, organizationId))
      .orderBy(asc(member.createdAt)),
    db
      .select({
        id: invitation.id,
        email: invitation.email,
        role: invitation.role,
        createdAt: invitation.createdAt,
        expiresAt: invitation.expiresAt,
        inviterName: user.name,
      })
      .from(invitation)
      .leftJoin(user, eq(user.id, invitation.inviterId))
      .where(
        and(
          eq(invitation.organizationId, organizationId),
          eq(invitation.status, "pending"),
          gt(invitation.expiresAt, now),
        ),
      )
      .orderBy(asc(invitation.createdAt)),
  ]);
  return {
    members: members.map((row) => ({ ...row, role: toRole(row.role) })) as TeamMemberRow[],
    invitations: invitations.map((row) => ({
      ...row,
      role: toRole(row.role ?? "viewer"),
    })) as PendingInvitationRow[],
  };
}

/** Invitation vue par la personne invitée (page /invitation/[id]), sans session. */
export async function getInvitationSummary(db: Executor, invitationId: string) {
  const [row] = await db
    .select({
      id: invitation.id,
      email: invitation.email,
      role: invitation.role,
      status: invitation.status,
      expiresAt: invitation.expiresAt,
      organizationId: organization.id,
      organizationName: organization.name,
      brandColor: sql<string>`coalesce(${tenantSettings.brandColor}, '#264489')`,
      inviterName: user.name,
    })
    .from(invitation)
    .innerJoin(organization, eq(organization.id, invitation.organizationId))
    .leftJoin(tenantSettings, eq(tenantSettings.organizationId, organization.id))
    .leftJoin(user, eq(user.id, invitation.inviterId))
    .where(eq(invitation.id, invitationId));
  return row ? { ...row, role: toRole(row.role ?? "viewer") } : null;
}

/** Préférences enregistrées d'un membre (les manquantes prennent la valeur par défaut du core). */
export async function getNotificationPreferences(db: Executor, memberId: string) {
  return db
    .select({
      type: notificationPreference.notificationType,
      email: notificationPreference.email,
      inApp: notificationPreference.inApp,
    })
    .from(notificationPreference)
    .where(eq(notificationPreference.memberId, memberId));
}

/** E-mails des membres qui veulent être prévenus par e-mail de ce type de notification. */
export async function listNotificationRecipients(
  db: Executor,
  organizationId: string,
  type: NotificationType,
): Promise<string[]> {
  const byDefault = NOTIFICATION_TYPES.find((entry) => entry.value === type)?.email ?? false;
  const rows = await db
    .select({ email: user.email, wants: notificationPreference.email })
    .from(member)
    .innerJoin(user, eq(user.id, member.userId))
    .leftJoin(
      notificationPreference,
      and(
        eq(notificationPreference.memberId, member.id),
        eq(notificationPreference.notificationType, type),
      ),
    )
    .where(eq(member.organizationId, organizationId));
  return rows.filter((row) => row.wants ?? byDefault).map((row) => row.email);
}
