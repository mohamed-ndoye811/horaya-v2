"use server";

import { findUsableJoinLink } from "@horaya/db";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth, getSession } from "@/server/auth";
import { authApiFormState } from "@/server/auth-errors";
import { db } from "@/server/db";
import type { FormState } from "@/server/form-state";
import { isJoinToken } from "@/server/invitation";

/** Rejoint l'espace d'un lien d'invitation général, avec le rôle choisi par l'équipe. */
export async function joinWithLinkAction(token: string): Promise<FormState> {
  const session = await getSession();
  if (!session) redirect(`/connexion?rejoindre=${token}`);
  const link = isJoinToken(token) ? await findUsableJoinLink(db, token, new Date()) : null;
  if (!link) return { error: "Ce lien n'est plus valable : demande-en un nouveau à l'équipe." };
  const requestHeaders = await headers();
  try {
    // Ajout côté serveur uniquement : le lien tient lieu d'invitation.
    await auth.api.addMember({
      body: { userId: session.user.id, organizationId: link.organizationId, role: link.role },
    });
    await auth.api.setActiveOrganization({
      body: { organizationId: link.organizationId },
      headers: requestHeaders,
    });
  } catch (error) {
    return authApiFormState(error);
  }
  redirect("/app");
}
