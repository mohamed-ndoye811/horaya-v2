"use server";

import { generateToken } from "@horaya/core";
import { deleteJoinLink, saveJoinLink } from "@horaya/db";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { z } from "zod";
import { ASSIGNABLE_ROLES, type AssignableRole, canManageTeam, JOIN_LINK_ROLES } from "@/lib/roles";
import { auth } from "@/server/auth";
import { authApiFormState } from "@/server/auth-errors";
import { db } from "@/server/db";
import type { FormState } from "@/server/form-state";
import { getWorkspaceContext } from "@/server/workspace";

const inviteSchema = z.object({
  email: z.email("Adresse e-mail invalide").trim().toLowerCase(),
  role: z.enum(ASSIGNABLE_ROLES, { error: "Choisis un rôle" }),
});

/** L'équipe passe par Better Auth (adhésions, invitations), qui vérifie aussi les droits. */
async function run(
  work: (organizationId: string, requestHeaders: Headers) => Promise<unknown>,
  success: string,
) {
  const { workspace } = await getWorkspaceContext();
  try {
    await work(workspace.id, await headers());
  } catch (error) {
    return authApiFormState(error);
  }
  revalidatePath("/app/parametres/membres");
  return { success } satisfies FormState;
}

export async function inviteMemberAction(_previous: FormState, form: FormData): Promise<FormState> {
  const parsed = inviteSchema.safeParse({ email: form.get("email"), role: form.get("role") });
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) fieldErrors[String(issue.path[0])] ??= issue.message;
    return { error: "Vérifie les champs en rouge.", fieldErrors };
  }
  const { email, role } = parsed.data;
  return run(
    (organizationId, requestHeaders) =>
      auth.api.createInvitation({ body: { email, role, organizationId }, headers: requestHeaders }),
    `Invitation envoyée à ${email}.`,
  );
}

export async function resendInvitationAction(
  email: string,
  role: AssignableRole,
): Promise<FormState> {
  return run(
    (organizationId, requestHeaders) =>
      auth.api.createInvitation({
        body: { email, role, organizationId, resend: true },
        headers: requestHeaders,
      }),
    `Invitation renvoyée à ${email}.`,
  );
}

export async function cancelInvitationAction(invitationId: string): Promise<FormState> {
  return run(
    (_organizationId, requestHeaders) =>
      auth.api.cancelInvitation({ body: { invitationId }, headers: requestHeaders }),
    "Invitation annulée.",
  );
}

export async function updateMemberRoleAction(
  memberId: string,
  role: AssignableRole,
): Promise<FormState> {
  if (!ASSIGNABLE_ROLES.includes(role)) return { error: "Rôle inconnu." };
  return run(
    (organizationId, requestHeaders) =>
      auth.api.updateMemberRole({
        body: { memberId, role, organizationId },
        headers: requestHeaders,
      }),
    "Rôle mis à jour.",
  );
}

export async function removeMemberAction(memberId: string): Promise<FormState> {
  return run(
    (organizationId, requestHeaders) =>
      auth.api.removeMember({
        body: { memberIdOrEmail: memberId, organizationId },
        headers: requestHeaders,
      }),
    "Membre retiré de l'espace.",
  );
}

/** Durée de validité du lien d'invitation général. */
const JOIN_LINK_DAYS = 7;

/** Le lien d'invitation se gère hors Better Auth : on vérifie le rôle ici. */
async function teamManager() {
  const { actor, workspace } = await getWorkspaceContext();
  return actor.type === "member" && canManageTeam(actor.role) ? { actor, workspace } : null;
}

/** Crée le lien d'invitation, ou le régénère : l'ancien cesse aussitôt de marcher. */
export async function createJoinLinkAction(role: AssignableRole): Promise<FormState> {
  const manager = await teamManager();
  if (!manager) return { error: "Seuls le propriétaire et les admins gèrent l'équipe." };
  if (!(JOIN_LINK_ROLES as readonly string[]).includes(role))
    return { error: "Rôle non autorisé." };
  await saveJoinLink(db, {
    organizationId: manager.workspace.id,
    token: generateToken(),
    role,
    expiresAt: new Date(Date.now() + JOIN_LINK_DAYS * 86_400_000),
    createdByMemberId: manager.actor.memberId,
  });
  revalidatePath("/app/parametres/membres");
  return { success: "Nouveau lien créé." };
}

export async function disableJoinLinkAction(): Promise<FormState> {
  const manager = await teamManager();
  if (!manager) return { error: "Seuls le propriétaire et les admins gèrent l'équipe." };
  await deleteJoinLink(db, manager.workspace.id);
  revalidatePath("/app/parametres/membres");
  return { success: "Lien désactivé." };
}
