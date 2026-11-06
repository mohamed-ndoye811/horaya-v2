import { createServerFn } from "@tanstack/react-start";
import { formDataInput } from "@/lib/form-data";
import { addNote, saveCustomer as save } from "@/server/clients";
import type { FormState } from "@/server/form-state";

/** Identifiant de la fiche, glissé dans le formulaire envoyé. */
const ID_FIELD = "_id";
const idOf = (form: FormData) => String(form.get(ID_FIELD) ?? "") || null;

const saveFn = createServerFn({ method: "POST" })
  .validator(formDataInput)
  .handler(({ data }) => save(idOf(data), data));
const noteFn = createServerFn({ method: "POST" })
  .validator(formDataInput)
  .handler(({ data }) => addNote(idOf(data) ?? "", data));

/** Ajout (customerId null) ou modification d'un client ; renvoie vers sa fiche. */
export function saveCustomer(customerId: string | null, _previous: FormState, form: FormData) {
  form.set(ID_FIELD, customerId ?? "");
  return saveFn({ data: form });
}

export function addNoteAction(customerId: string, _previous: FormState, form: FormData) {
  form.set(ID_FIELD, customerId);
  return noteFn({ data: form });
}
