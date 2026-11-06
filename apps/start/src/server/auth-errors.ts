import { isAPIError } from "better-auth/api";
import type { FormState } from "./form-state";

/** Messages des erreurs Better Auth côté serveur (équipe, profil). */
const MESSAGES: Record<string, string> = {
  USER_IS_ALREADY_A_MEMBER_OF_THIS_ORGANIZATION: "Cette personne fait déjà partie de l'espace.",
  USER_IS_ALREADY_INVITED_TO_THIS_ORGANIZATION: "Cette personne a déjà une invitation en attente.",
  YOU_ARE_NOT_ALLOWED_TO_INVITE_USERS_TO_THIS_ORGANIZATION:
    "Ton rôle ne permet pas d'inviter des membres.",
  YOU_ARE_NOT_ALLOWED_TO_INVITE_USER_WITH_THIS_ROLE: "Ton rôle ne permet pas de donner ce rôle.",
  YOU_ARE_NOT_ALLOWED_TO_UPDATE_THIS_MEMBER: "Ton rôle ne permet pas de modifier ce membre.",
  YOU_ARE_NOT_ALLOWED_TO_DELETE_THIS_MEMBER: "Ton rôle ne permet pas de retirer ce membre.",
  YOU_CANNOT_LEAVE_THE_ORGANIZATION_AS_THE_ONLY_OWNER: "L'espace doit garder un propriétaire.",
  YOU_ARE_NOT_ALLOWED_TO_CANCEL_THIS_INVITATION:
    "Ton rôle ne permet pas d'annuler cette invitation.",
  INVITATION_NOT_FOUND: "Cette invitation n'existe plus.",
  MEMBER_NOT_FOUND: "Ce membre ne fait plus partie de l'espace.",
  YOU_ARE_NOT_THE_RECIPIENT_OF_THE_INVITATION:
    "Cette invitation est adressée à une autre adresse e-mail.",
  ORGANIZATION_SLUG_ALREADY_TAKEN: "Cette adresse est déjà prise.",
  YOU_ARE_NOT_ALLOWED_TO_UPDATE_THIS_ORGANIZATION: "Ton rôle ne permet pas de modifier l'espace.",
  INVALID_PASSWORD: "Mot de passe actuel incorrect.",
  CREDENTIAL_ACCOUNT_NOT_FOUND: "Ton compte se connecte avec Google : il n'a pas de mot de passe.",
};

/** Traduit une erreur Better Auth levée par auth.api en état de formulaire ; relance le reste. */
export function authApiFormState(error: unknown): FormState {
  if (isAPIError(error)) {
    const code = (error.body as { code?: string } | undefined)?.code;
    if (code === "WEAK_PASSWORD" && error.body?.message)
      return { error: String(error.body.message) };
    if (code && MESSAGES[code]) return { error: MESSAGES[code] };
    console.error("Better Auth", code, error.body?.message);
    return { error: "Action impossible pour le moment. Réessaie dans un instant." };
  }
  throw error;
}
