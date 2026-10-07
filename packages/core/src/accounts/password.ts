import { ValidationError } from "../shared/errors";

export const PASSWORD_MIN_LENGTH = 12;
export const PASSWORD_MAX_LENGTH = 128;

type PasswordRuleId = "length" | "case" | "digit" | "special";

interface PasswordRule {
  id: PasswordRuleId;
  label: string;
  /** Une règle obligatoire bloque l'enregistrement ; les autres renforcent seulement. */
  required: boolean;
  test: (password: string) => boolean;
}

const RULES: readonly PasswordRule[] = [
  {
    id: "length",
    label: `${PASSWORD_MIN_LENGTH} caractères minimum`,
    required: true,
    test: (password) => password.length >= PASSWORD_MIN_LENGTH,
  },
  {
    id: "case",
    label: "Une majuscule et une minuscule",
    required: true,
    test: (password) => /\p{Lu}/u.test(password) && /\p{Ll}/u.test(password),
  },
  {
    id: "digit",
    label: "Au moins un chiffre",
    required: true,
    test: (password) => /\d/.test(password),
  },
  {
    id: "special",
    label: "Un caractère spécial (! ? @ # …)",
    required: false,
    test: (password) => /[^\p{L}\d\s]/u.test(password),
  },
];

export type PasswordStrength = "faible" | "correct" | "robuste";

export interface PasswordCheck {
  rules: ReadonlyArray<{ id: PasswordRuleId; label: string; required: boolean; met: boolean }>;
  /** Nombre de règles respectées, de 0 à 4 (une barre de la jauge par règle). */
  score: number;
  strength: PasswordStrength;
  acceptable: boolean;
}

/** Évalue un mot de passe. Partagé par l'interface (jauge en direct) et le serveur. */
export function checkPassword(password: string): PasswordCheck {
  const rules = RULES.map(({ id, label, required, test }) => ({
    id,
    label,
    required,
    met: test(password),
  }));
  const acceptable =
    password.length <= PASSWORD_MAX_LENGTH && rules.every((rule) => !rule.required || rule.met);
  const score = rules.filter((rule) => rule.met).length;
  const strength: PasswordStrength = !acceptable
    ? "faible"
    : score === rules.length
      ? "robuste"
      : "correct";

  return { rules, score, strength, acceptable };
}

export function assertAcceptablePassword(password: string): void {
  const check = checkPassword(password);
  if (check.acceptable) return;

  if (password.length > PASSWORD_MAX_LENGTH) {
    throw new ValidationError(
      `Le mot de passe ne doit pas dépasser ${PASSWORD_MAX_LENGTH} caractères.`,
    );
  }
  const missing = check.rules.filter((rule) => rule.required && !rule.met);
  throw new ValidationError(
    "Mot de passe trop faible",
    missing.map((rule) => ({ path: "password", message: rule.label })),
  );
}
