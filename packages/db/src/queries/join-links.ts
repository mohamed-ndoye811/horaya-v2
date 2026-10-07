import { MEMBER_ROLES, type MemberRole } from "@horaya/core";
import { and, eq, gt, sql } from "drizzle-orm";
import type { Executor } from "../client";
import { joinLink, organization, tenantSettings } from "../schema";

const toRole = (role: string): MemberRole =>
  (MEMBER_ROLES as readonly string[]).includes(role) && role !== "owner"
    ? (role as MemberRole)
    : "viewer";

/** Lien d'invitation général de l'espace (écran 25), même expiré : null s'il n'y en a pas. */
export async function getJoinLink(db: Executor, organizationId: string) {
  const [row] = await db
    .select({ token: joinLink.token, role: joinLink.role, expiresAt: joinLink.expiresAt })
    .from(joinLink)
    .where(eq(joinLink.organizationId, organizationId));
  return row ? { ...row, role: toRole(row.role) } : null;
}

/** Crée ou remplace le lien : l'ancien cesse aussitôt de marcher. */
export async function saveJoinLink(
  db: Executor,
  link: {
    organizationId: string;
    token: string;
    role: MemberRole;
    expiresAt: Date;
    createdByMemberId: string | null;
  },
) {
  await db
    .insert(joinLink)
    .values(link)
    .onConflictDoUpdate({
      target: joinLink.organizationId,
      set: {
        token: link.token,
        role: link.role,
        expiresAt: link.expiresAt,
        createdByMemberId: link.createdByMemberId,
        createdAt: new Date(),
      },
    });
}

export async function deleteJoinLink(db: Executor, organizationId: string) {
  await db.delete(joinLink).where(eq(joinLink.organizationId, organizationId));
}

/** Espace et rôle d'un lien encore valable, pour la page « Rejoindre ». */
export async function findUsableJoinLink(db: Executor, token: string, now: Date) {
  const [row] = await db
    .select({
      organizationId: joinLink.organizationId,
      organizationName: organization.name,
      brandColor: sql<string>`coalesce(${tenantSettings.brandColor}, '#264489')`,
      role: joinLink.role,
      expiresAt: joinLink.expiresAt,
    })
    .from(joinLink)
    .innerJoin(organization, eq(organization.id, joinLink.organizationId))
    .leftJoin(tenantSettings, eq(tenantSettings.organizationId, organization.id))
    .where(and(eq(joinLink.token, token), gt(joinLink.expiresAt, now)));
  return row ? { ...row, role: toRole(row.role) } : null;
}
