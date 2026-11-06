/** Invitations (par e-mail et lien général) : logique serveur (voir functions/invitations.ts). */
import { findUsableJoinLink, getInvitationSummary } from "@horaya/db";
import { redirect } from "@tanstack/react-router";
import { auth, getSession, listMyWorkspaces, requestHeaders } from "./auth";
import { authApiFormState } from "./auth-errors";
import { db } from "./db";
import type { FormState } from "./form-state";
import { isInvitationId, isJoinToken } from "./invitation";

/** Page ouverte depuis l'e-mail d'invitation. */
export async function invitationPage(id: string) {
  const [summary, session] = await Promise.all([
    isInvitationId(id) ? getInvitationSummary(db, id) : null,
    getSession(),
  ]);
  return {
    id,
    invitation: summary && {
      status: summary.status,
      expired: summary.expiresAt <= new Date(),
      email: summary.email,
      role: summary.role,
      organizationName: summary.organizationName,
      inviterName: summary.inviterName,
    },
    sessionEmail: session?.user.email ?? null,
  };
}

/** Rejoint l'espace et l'ouvre aussitôt. */
export async function acceptInvitation(invitationId: string): Promise<FormState> {
  const headers = requestHeaders();
  try {
    const accepted = await auth.api.acceptInvitation({ body: { invitationId }, headers });
    const organizationId = accepted?.member.organizationId;
    if (organizationId) {
      await auth.api.setActiveOrganization({ body: { organizationId }, headers });
    }
  } catch (error) {
    return authApiFormState(error);
  }
  throw redirect({ href: "/app" });
}

export async function rejectInvitation(invitationId: string): Promise<FormState> {
  try {
    await auth.api.rejectInvitation({ body: { invitationId }, headers: requestHeaders() });
  } catch (error) {
    return authApiFormState(error);
  }
  throw redirect({ href: `/invitation/${invitationId}` });
}

/** Lien d'invitation général d'un espace (écran 25). */
export async function joinPage(token: string) {
  const [link, session] = await Promise.all([
    isJoinToken(token) ? findUsableJoinLink(db, token, new Date()) : null,
    getSession(),
  ]);
  const alreadyMember =
    link && session
      ? (await listMyWorkspaces()).some((workspace) => workspace.id === link.organizationId)
      : false;
  return {
    token,
    link: link && { organizationName: link.organizationName, role: link.role },
    signedIn: Boolean(session),
    alreadyMember,
  };
}

/** Rejoint l'espace d'un lien d'invitation général, avec le rôle choisi par l'équipe. */
export async function joinWithLink(token: string): Promise<FormState> {
  const session = await getSession();
  if (!session) throw redirect({ href: `/connexion?rejoindre=${token}` });
  const link = isJoinToken(token) ? await findUsableJoinLink(db, token, new Date()) : null;
  if (!link) return { error: "Ce lien n'est plus valable : demande-en un nouveau à l'équipe." };
  try {
    // Ajout côté serveur uniquement : le lien tient lieu d'invitation.
    await auth.api.addMember({
      body: { userId: session.user.id, organizationId: link.organizationId, role: link.role },
    });
    await auth.api.setActiveOrganization({
      body: { organizationId: link.organizationId },
      headers: requestHeaders(),
    });
  } catch (error) {
    return authApiFormState(error);
  }
  throw redirect({ href: "/app" });
}
