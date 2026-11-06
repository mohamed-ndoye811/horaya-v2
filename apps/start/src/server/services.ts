import { type Actor, type Deps, MEMBER_ROLES, type MemberRole } from "@horaya/core";
import { createDeps } from "@horaya/db";
import { redirect } from "@tanstack/react-router";
import { auth, requestHeaders, requireSession } from "./auth";
import { notifyFromActivity } from "./booking-emails";
import { db } from "./db";

/**
 * Dépendances des cas d'usage du core : l'app web les appelle directement, sans passer par l'API.
 * Après chaque transaction validée, les changements de réservation partent par e-mail.
 */
export const deps: Deps = createDeps(db, {
  async afterCommit(entries) {
    await notifyFromActivity(entries);
    // Import différé : les effets de paiement dépendent eux-mêmes de `deps`.
    const { paymentEffects } = await import("./payments/effects");
    await paymentEffects(entries);
  },
});

export type MemberActor = Extract<Actor, { type: "member" }>;

/** Membre connecté dans son espace actif, prêt à être passé aux cas d'usage. */
export async function requireMember(): Promise<MemberActor> {
  const session = await requireSession();
  const member = await auth.api.getActiveMember({ headers: requestHeaders() });
  if (!member) throw redirect({ href: "/inscription/espace" });

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
}
