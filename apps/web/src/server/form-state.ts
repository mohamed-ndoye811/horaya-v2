import { DomainError, ValidationError } from "@horaya/core";

/** État renvoyé par les actions serveur des formulaires (useActionState). */
export interface FormState {
  error?: string;
  fieldErrors?: Record<string, string>;
  success?: string;
}

/** Traduit une erreur du core en état de formulaire ; relance les erreurs inattendues. */
export function toFormState(error: unknown): FormState {
  if (error instanceof ValidationError) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of error.issues) {
      const key = issue.path.split(".")[0] || "form";
      fieldErrors[key] ??= issue.message;
    }
    return {
      error: Object.keys(fieldErrors).length > 0 ? "Vérifie les champs en rouge." : error.message,
      fieldErrors,
    };
  }
  if (error instanceof DomainError) return { error: error.message };
  throw error;
}
