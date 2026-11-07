import { createServerFn } from "@tanstack/react-start";
import { formDataInput } from "@/lib/form-data";
import { deleteMyAccount, deleteMyWorkspace, stopImpersonation } from "@/server/privacy";

/** RGPD : supprimer son compte (mot de passe), ou l'espace dont on est propriétaire. */
export const deleteAccount = createServerFn({ method: "POST" })
  .validator(formDataInput)
  .handler(({ data }) => deleteMyAccount(data));

export const deleteWorkspace = createServerFn({ method: "POST" })
  .validator(formDataInput)
  .handler(({ data }) => deleteMyWorkspace(data));

/** Bandeau « Connecté en tant que… » : revenir à son compte. */
export const endImpersonation = createServerFn({ method: "POST" }).handler(() =>
  stopImpersonation(),
);
