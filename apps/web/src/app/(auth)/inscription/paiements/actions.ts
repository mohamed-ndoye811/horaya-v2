"use server";

import { updateTenantSettings } from "@horaya/core";
import { redirect } from "next/navigation";
import { type FormState, toFormState } from "@/server/form-state";
import { deps } from "@/server/services";
import { getWorkspaceContext } from "@/server/workspace";

/** Étape 3 de l'inscription : enregistre le lien de paiement (facultatif), puis ouvre l'espace. */
export async function savePaymentLinkAction(
  _previous: FormState,
  form: FormData,
): Promise<FormState> {
  const { actor } = await getWorkspaceContext();
  const paymentLinkUrl = String(form.get("paymentLinkUrl") ?? "").trim();
  if (paymentLinkUrl) {
    try {
      await updateTenantSettings(deps, actor, { paymentLinkUrl });
    } catch (error) {
      return toFormState(error);
    }
  }
  redirect("/app");
}
