/** Clients : logique serveur des formulaires (voir functions/clients.ts). */
import { addCustomerNote, createCustomer, updateCustomer } from "@horaya/core";
import { redirect } from "@tanstack/react-router";
import { type FormState, toFormState } from "./form-state";
import { deps } from "./services";
import { getWorkspaceContext } from "./workspace";

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
export async function saveCustomer(customerId: string | null, form: FormData): Promise<FormState> {
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
  throw redirect({ href: `/app/clients/${targetId}` });
}

export async function addNote(customerId: string, form: FormData): Promise<FormState> {
  const { actor } = await getWorkspaceContext();
  try {
    await addCustomerNote(deps, actor, customerId, {
      body: text(form, "body"),
      pinned: form.get("pinned") === "on",
    });
  } catch (error) {
    return toFormState(error);
  }
  return { success: "Note ajoutée." };
}
