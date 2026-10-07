"use server";

import { checkPassword } from "@horaya/core";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { auth, requireSession } from "@/server/auth";
import { authApiFormState } from "@/server/auth-errors";
import type { FormState } from "@/server/form-state";

const text = (form: FormData, key: string) => String(form.get(key) ?? "").trim();

export async function saveProfileAction(_previous: FormState, form: FormData): Promise<FormState> {
  await requireSession();
  const firstName = text(form, "firstName");
  const lastName = text(form, "lastName");
  const fieldErrors: Record<string, string> = {};
  if (!firstName) fieldErrors.firstName = "Indique ton prénom";
  if (!lastName) fieldErrors.lastName = "Indique ton nom";
  if (firstName.length > 60) fieldErrors.firstName = "60 caractères maximum";
  if (lastName.length > 60) fieldErrors.lastName = "60 caractères maximum";
  if (Object.keys(fieldErrors).length > 0)
    return { error: "Vérifie les champs en rouge.", fieldErrors };
  try {
    await auth.api.updateUser({
      body: { firstName, lastName, name: `${firstName} ${lastName}` },
      headers: await headers(),
    });
  } catch (error) {
    return authApiFormState(error);
  }
  revalidatePath("/app", "layout");
  return { success: "Profil enregistré." };
}

export async function changePasswordAction(
  _previous: FormState,
  form: FormData,
): Promise<FormState> {
  await requireSession();
  const currentPassword = String(form.get("currentPassword") ?? "");
  const newPassword = String(form.get("newPassword") ?? "");
  const check = checkPassword(newPassword);
  if (!check.acceptable) {
    const missing = check.rules.filter((rule) => rule.required && !rule.met);
    return {
      error: "Vérifie les champs en rouge.",
      fieldErrors: {
        newPassword: `Il manque : ${missing.map((rule) => rule.label.toLowerCase()).join(", ")}.`,
      },
    };
  }
  try {
    await auth.api.changePassword({
      body: {
        currentPassword,
        newPassword,
        revokeOtherSessions: form.get("revokeOtherSessions") === "on",
      },
      headers: await headers(),
    });
  } catch (error) {
    return authApiFormState(error);
  }
  return { success: "Mot de passe modifié." };
}
