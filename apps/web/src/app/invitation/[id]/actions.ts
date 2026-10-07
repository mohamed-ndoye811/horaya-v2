"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/server/auth";
import { authApiFormState } from "@/server/auth-errors";
import type { FormState } from "@/server/form-state";

/** Rejoint l'espace et l'ouvre aussitôt. */
export async function acceptInvitationAction(invitationId: string): Promise<FormState> {
  const requestHeaders = await headers();
  try {
    const accepted = await auth.api.acceptInvitation({
      body: { invitationId },
      headers: requestHeaders,
    });
    const organizationId = accepted?.member.organizationId;
    if (organizationId) {
      await auth.api.setActiveOrganization({ body: { organizationId }, headers: requestHeaders });
    }
  } catch (error) {
    return authApiFormState(error);
  }
  redirect("/app");
}

export async function rejectInvitationAction(invitationId: string): Promise<FormState> {
  try {
    await auth.api.rejectInvitation({ body: { invitationId }, headers: await headers() });
  } catch (error) {
    return authApiFormState(error);
  }
  redirect(`/invitation/${invitationId}`);
}
