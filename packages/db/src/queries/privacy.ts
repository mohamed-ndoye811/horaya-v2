import { and, eq } from "drizzle-orm";
import type { Executor } from "../client";
import { member, organization } from "../schema";

/*
 * Suppressions (RGPD) : un compte ne part qu'une fois ses espaces supprimés ou donnés ; un
 * espace part avec toutes ses données (clés étrangères en cascade sur l'organisation).
 */

/** Espaces dont la personne est propriétaire : à supprimer ou à donner avant son compte. */
export function ownedWorkspaces(db: Executor, userId: string) {
  return db
    .select({ id: organization.id, name: organization.name, slug: organization.slug })
    .from(member)
    .innerJoin(organization, eq(organization.id, member.organizationId))
    .where(and(eq(member.userId, userId), eq(member.role, "owner")));
}

/** Supprime l'espace et tout ce qu'il contient (événements, réservations, clients…). */
export async function deleteWorkspace(db: Executor, organizationId: string): Promise<boolean> {
  const deleted = await db
    .delete(organization)
    .where(eq(organization.id, organizationId))
    .returning({ id: organization.id });
  return deleted.length > 0;
}
