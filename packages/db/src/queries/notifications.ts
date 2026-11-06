import { NOTIFICATION_TYPES, type NotificationType } from "@horaya/core";
import { and, desc, eq, isNull, sql } from "drizzle-orm";
import type { Executor } from "../client";
import { member, notification, notificationPreference } from "../schema";

export interface NotificationRow {
  id: string;
  type: string;
  title: string;
  body: string | null;
  link: string | null;
  readAt: Date | null;
  createdAt: Date;
}

/** Une notification dans l'app pour chaque membre qui la veut (sa préférence, sinon le réglage par défaut). */
export async function createNotifications(
  db: Executor,
  organizationId: string,
  type: NotificationType,
  content: { title: string; body?: string | null; link?: string | null },
) {
  const byDefault = NOTIFICATION_TYPES.find((entry) => entry.value === type)?.inApp ?? false;
  const rows = await db
    .select({ memberId: member.id, wants: notificationPreference.inApp })
    .from(member)
    .leftJoin(
      notificationPreference,
      and(
        eq(notificationPreference.memberId, member.id),
        eq(notificationPreference.notificationType, type),
      ),
    )
    .where(eq(member.organizationId, organizationId));
  const recipients = rows.filter((row) => row.wants ?? byDefault);
  if (recipients.length === 0) return;
  await db.insert(notification).values(
    recipients.map(({ memberId }) => ({
      organizationId,
      memberId,
      type,
      title: content.title,
      body: content.body ?? null,
      link: content.link ?? null,
    })),
  );
}

/** Dernières notifications d'un membre, les plus récentes d'abord. */
export async function listNotifications(
  db: Executor,
  memberId: string,
  limit = 20,
): Promise<NotificationRow[]> {
  return db
    .select({
      id: notification.id,
      type: notification.type,
      title: notification.title,
      body: notification.body,
      link: notification.link,
      readAt: notification.readAt,
      createdAt: notification.createdAt,
    })
    .from(notification)
    .where(eq(notification.memberId, memberId))
    .orderBy(desc(notification.createdAt))
    .limit(limit);
}

export async function countUnreadNotifications(db: Executor, memberId: string) {
  const [row] = await db
    .select({ value: sql<number>`count(*)::int` })
    .from(notification)
    .where(and(eq(notification.memberId, memberId), isNull(notification.readAt)));
  return row?.value ?? 0;
}

export async function markNotificationsRead(db: Executor, memberId: string) {
  await db
    .update(notification)
    .set({ readAt: new Date() })
    .where(and(eq(notification.memberId, memberId), isNull(notification.readAt)));
}
