import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { formDataInput } from "@/lib/form-data";
import type { FormState } from "@/server/form-state";
import {
  authPage,
  checkSlug as check,
  createWorkspace as create,
  onboardingStep,
  type ResetPasswordState,
  resetPassword as reset,
  resetPasswordPage,
  savePaymentLink,
  type WorkspaceFormState,
} from "@/server/onboarding";

/** Paramètres de la connexion et de l'inscription : invitation par e-mail ou lien général. */
export const authSearch = z.object({
  invitation: z.string().optional().catch(undefined),
  rejoindre: z.string().optional().catch(undefined),
});

/** Connexion / inscription : renvoie vers l'espace si déjà connecté. */
export const getAuthPage = createServerFn({ method: "GET" })
  .validator(authSearch)
  .handler(({ data }) => authPage(data));

/** Étapes 2 (espace) et 3 (paiements) de l'inscription : redirige si l'étape n'a pas lieu d'être. */
export const getOnboardingStep = createServerFn({ method: "GET" })
  .validator(z.enum(["espace", "paiements"]))
  .handler(({ data }) => onboardingStep(data));

export const resetSearch = z.object({ token: z.string().optional().catch(undefined) });

export const getResetPasswordPage = createServerFn({ method: "GET" })
  .validator(z.string())
  .handler(({ data }) => resetPasswordPage(data));

const resetFn = createServerFn({ method: "POST" })
  .validator(formDataInput)
  .handler(({ data }) => reset(String(data.get("_token") ?? ""), data));

/** Enregistre le nouveau mot de passe puis connecte directement l'utilisateur. */
export function resetPassword(token: string, _previous: ResetPasswordState, form: FormData) {
  form.set("_token", token);
  return resetFn({ data: form });
}

const checkSlugFn = createServerFn({ method: "GET" })
  .validator(z.string())
  .handler(({ data }) => check(data));

/** Vérification en direct de l'adresse de la page publique. */
export const checkSlug = (slug: string) => checkSlugFn({ data: slug });

const createWorkspaceFn = createServerFn({ method: "POST" })
  .validator(formDataInput)
  .handler(({ data }) => create(data));

export const createWorkspace = (_previous: WorkspaceFormState, form: FormData) =>
  createWorkspaceFn({ data: form });

const savePaymentLinkFn = createServerFn({ method: "POST" })
  .validator(formDataInput)
  .handler(({ data }) => savePaymentLink(data));

export const savePaymentLinkAction = (_previous: FormState, form: FormData) =>
  savePaymentLinkFn({ data: form });
