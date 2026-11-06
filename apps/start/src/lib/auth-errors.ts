const MESSAGES: Record<string, string> = {
  INVALID_EMAIL_OR_PASSWORD: "E-mail ou mot de passe incorrect.",
  INVALID_EMAIL: "Cette adresse e-mail n'est pas valide.",
  INVALID_PASSWORD: "Mot de passe incorrect.",
  USER_ALREADY_EXISTS: "Un compte existe déjà avec cet e-mail. Connecte-toi plutôt.",
  USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL:
    "Un compte existe déjà avec cet e-mail. Connecte-toi plutôt.",
  PASSWORD_TOO_SHORT: "Mot de passe trop court : 12 caractères minimum.",
  PASSWORD_TOO_LONG: "Mot de passe trop long : 128 caractères maximum.",
  INVALID_TOKEN: "Ce lien n'est plus valide. Demande-en un nouveau.",
  EMAIL_NOT_VERIFIED: "Confirme d'abord ton adresse e-mail.",
  ORGANIZATION_ALREADY_EXISTS: "Cette adresse est déjà prise.",
  SLUG_IS_TAKEN: "Cette adresse est déjà prise.",
};

/** Traduit une erreur Better Auth en message affichable. */
export function authErrorMessage(error: {
  code?: string;
  message?: string;
  status?: number;
}): string {
  if (error.status === 429) return "Trop de tentatives. Patiente une minute avant de réessayer.";
  if (error.code === "WEAK_PASSWORD" && error.message) return error.message;
  return (
    (error.code && MESSAGES[error.code]) || "Une erreur est survenue. Réessaie dans un instant."
  );
}
