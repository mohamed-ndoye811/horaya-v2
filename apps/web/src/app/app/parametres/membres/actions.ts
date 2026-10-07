"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { z } from "zod";
import { ASSIGNABLE_ROLES, type AssignableRole } from "@/lib/roles";
import { auth } from "@/server/auth";
import { authApiFormState } from "@/server/auth-errors";
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
