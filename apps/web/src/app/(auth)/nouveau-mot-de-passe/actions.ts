"use server";

import { assertAcceptablePassword, DomainError } from "@horaya/core";
import { isAPIError } from "better-auth/api";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/server/auth";
import { findPasswordResetEmail } from "./reset-token";

export interface ResetPasswordState {
  error?: string;
  expired?: boolean;
}

/** Enregistre le nouveau mot de passe puis connecte directement l'utilisateur. */
export async function resetPassword(
  token: string,
  _previous: ResetPasswordState,
  formData: FormData,
): Promise<ResetPasswordState> {
  const password = String(formData.get("password") ?? "");
  const confirmation = String(formData.get("confirmation") ?? "");

  try {
    assertAcceptablePassword(password);
  } catch (error) {
    if (error instanceof DomainError)
      return { error: "Le mot de passe ne respecte pas les règles." };
    throw error;
  }
  if (password !== confirmation) return { error: "Les deux mots de passe ne correspondent pas." };

  // L'e-mail vient du jeton côté serveur, jamais du formulaire.
  const email = await findPasswordResetEmail(token);
  if (!email) return { expired: true };

  try {
    await auth.api.resetPassword({ body: { newPassword: password, token } });
    await auth.api.signInEmail({ body: { email, password }, headers: await headers() });
  } catch (error) {
    if (isAPIError(error) && error.body?.code === "INVALID_TOKEN") return { expired: true };
    console.error("resetPassword", error);
    return { error: "Impossible d'enregistrer le mot de passe. Réessaie dans un instant." };
  }
  redirect("/app");
}
