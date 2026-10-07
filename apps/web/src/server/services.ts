import { type Actor, type Deps, MEMBER_ROLES, type MemberRole } from "@horaya/core";
import { createDeps } from "@horaya/db";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { auth, requireSession } from "./auth";
import { db } from "./db";

/** Dépendances des cas d'usage du core : l'app web les appelle directement, sans passer par l'API. */
export const deps: Deps = createDeps(db);

export type MemberActor = Extract<Actor, { type: "member" }>;

/** Membre connecté dans son espace actif, prêt à être passé aux cas d'usage. */
export const requireMember = cache(async (): Promise<MemberActor> => {
  const session = await requireSession();
  const member = await auth.api.getActiveMember({ headers: await headers() });
  if (!member) redirect("/inscription/espace");

  const role = (MEMBER_ROLES as readonly string[]).includes(member.role)
    ? (member.role as MemberRole)
    : "viewer";
  return {
    type: "member",
    organizationId: member.organizationId,
    userId: session.user.id,
    memberId: member.id,
    role,
  };
});
