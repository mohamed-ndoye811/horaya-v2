"use server";

import { addCustomerNote, createCustomer, updateCustomer } from "@horaya/core";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { type FormState, toFormState } from "@/server/form-state";
import { deps } from "@/server/services";
import { getWorkspaceContext } from "@/server/workspace";

const text = (form: FormData, key: string) => String(form.get(key) ?? "").trim();

function customerFields(form: FormData) {
  return {
    firstName: text(form, "firstName"),
    lastName: text(form, "lastName"),
    email: text(form, "email"),
    phone: text(form, "phone") || null,
    company: text(form, "company") || null,
    tags: text(form, "tags")
      .split(",")
      .map((tag) => tag.trim())
      .filter(Boolean),
    marketingConsent: form.get("marketingConsent") === "on",
  };
}

/** Ajout (customerId null) ou modification d'un client. */
export async function saveCustomer(
  customerId: string | null,
  _previous: FormState,
  form: FormData,
): Promise<FormState> {
  const { actor } = await getWorkspaceContext();
  let targetId: string;
  try {
    const saved = customerId
      ? await updateCustomer(deps, actor, customerId, customerFields(form))
      : await createCustomer(deps, actor, customerFields(form));
    targetId = saved.id;
  } catch (error) {
    return toFormState(error);
  }
  revalidatePath("/app", "layout");
  redirect(`/app/clients/${targetId}`);
}

export async function addNoteAction(
  customerId: string,
  _previous: FormState,
  form: FormData,
): Promise<FormState> {
  const { actor } = await getWorkspaceContext();
  try {
    await addCustomerNote(deps, actor, customerId, {
      body: text(form, "body"),
      pinned: form.get("pinned") === "on",
    });
  } catch (error) {
    return toFormState(error);
  }
  revalidatePath(`/app/clients/${customerId}`);
  return { success: "Note ajoutée." };
}
