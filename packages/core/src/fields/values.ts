import { ValidationError } from "../shared/errors";
import type {
  EventTypeField,
  FieldDefinition,
  FieldScope,
  FieldValue,
  FieldValues,
  RawFieldValue,
  RawFieldValues,
} from "./model";

/** Condition d'affichage : vraie sans condition, sinon selon la réponse au champ visé. */
export function isFieldShown(field: FieldDefinition, values: FieldValues): boolean {
  if (!field.condition) return true;
  const answer = values[field.condition.fieldKey];
  if (Array.isArray(answer)) return answer.includes(String(field.condition.equals));
  return answer === field.condition.equals;
}

export const fieldsOfScope = <F extends EventTypeField>(fields: F[], scope: FieldScope): F[] =>
  fields.filter((field) => field.scope === scope);

const TRUE = new Set(["true", "on", "oui", "1"]);
const FALSE = new Set(["false", "off", "non", "0"]);
const ISO_INSTANT = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z$/;

function isCivilDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().startsWith(value);
}

function isWebUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
}

/** Réponse brute → valeur, `undefined` si vide, ou message d'erreur. */
function coerce(
  field: FieldDefinition,
  raw: RawFieldValue | undefined,
  now: Date,
): { value?: FieldValue; error?: string } {
  const list = (Array.isArray(raw) ? raw : raw == null ? [] : [String(raw)])
    .map((entry) => entry.trim())
    .filter(Boolean);
  const text = typeof raw === "string" ? raw.trim() : raw == null ? "" : String(raw);

  switch (field.type) {
    case "short_text":
    case "long_text": {
      if (!text) return {};
      const max = field.type === "short_text" ? 500 : 5000;
      return text.length > max ? { error: `${max} caractères maximum` } : { value: text };
    }
    case "number": {
      if (!text) return {};
      const number = Number(text.replace(",", "."));
      return Number.isFinite(number) ? { value: number } : { error: "Nombre attendu" };
    }
    case "boolean": {
      if (typeof raw === "boolean") return { value: raw };
      if (!text) return {};
      const lower = text.toLowerCase();
      if (TRUE.has(lower)) return { value: true };
      if (FALSE.has(lower)) return { value: false };
      return { error: "Réponds par oui ou non" };
    }
    case "choice": {
      if (!text) return {};
      return field.options?.includes(text) ? { value: text } : { error: "Choix inconnu" };
    }
    case "multi_choice": {
      if (list.length === 0) return {};
      const unknown = list.find((entry) => !field.options?.includes(entry));
      return unknown ? { error: "Choix inconnu" } : { value: [...new Set(list)] };
    }
    case "date": {
      if (!text) return {};
      return isCivilDate(text) ? { value: text } : { error: "Date invalide" };
    }
    case "url": {
      if (!text) return {};
      return isWebUrl(text) && text.length <= 500
        ? { value: text }
        : { error: "Adresse invalide (https://…)" };
    }
    case "acceptance": {
      // L'instant de l'acceptation fait foi ; une acceptation déjà horodatée est conservée.
      if (typeof raw === "string" && ISO_INSTANT.test(raw)) return { value: raw };
      const accepted = raw === true || TRUE.has(text.toLowerCase());
      return accepted ? { value: now.toISOString() } : {};
    }
  }
}

/**
 * Valide des réponses contre leurs définitions, dans l'ordre : un champ masqué par sa
 * condition est ignoré (sa réponse éventuelle est jetée), les clés inconnues aussi.
 * `enforceRequired: false` pour l'équipe, qui peut saisir sans tout savoir.
 */
export function parseFieldValues(
  fields: FieldDefinition[],
  raw: RawFieldValues,
  { now, enforceRequired = true }: { now: Date; enforceRequired?: boolean },
): { values: FieldValues; errors: Record<string, string> } {
  const values: FieldValues = {};
  const errors: Record<string, string> = {};
  for (const field of fields) {
    if (!isFieldShown(field, values)) continue;
    const { value, error } = coerce(field, raw[field.key], now);
    if (error) errors[field.key] = error;
    else if (value !== undefined) values[field.key] = value;
    else if (field.required && enforceRequired) {
      errors[field.key] = field.type === "acceptance" ? "Coche la case pour continuer" : "Requis";
    }
  }
  return { values, errors };
}

/** Comme `parseFieldValues`, mais lève une ValidationError (chemins `${prefix}.${clé}`). */
export function validateFieldValues(
  fields: FieldDefinition[],
  raw: RawFieldValues,
  options: { now: Date; enforceRequired?: boolean },
  prefix: string,
): FieldValues {
  const { values, errors } = parseFieldValues(fields, raw, options);
  const issues = Object.entries(errors).map(([key, message]) => ({
    path: `${prefix}.${key}`,
    message,
  }));
  if (issues.length > 0) throw new ValidationError("Vérifie les réponses en rouge.", issues);
  return values;
}

/**
 * Réponses d'une inscription : questions « une fois », puis celles de chaque participant.
 * Toutes les erreurs remontent ensemble (chemins `answers.clé`, `participants.0.answers.clé`).
 */
export function validateBookingAnswers<P extends { answers: RawFieldValues }>(
  fields: EventTypeField[],
  input: { answers: RawFieldValues; participants: P[] },
  options: { now: Date; enforceRequired?: boolean },
): {
  answers: FieldValues;
  participants: Array<Omit<P, "answers"> & { answers: FieldValues }>;
  issues: Array<{ path: string; message: string }>;
} {
  const issues: Array<{ path: string; message: string }> = [];
  const collect = (scope: FieldScope, raw: RawFieldValues, prefix: string) => {
    const { values, errors } = parseFieldValues(fieldsOfScope(fields, scope), raw, options);
    for (const [key, message] of Object.entries(errors)) {
      issues.push({ path: `${prefix}.${key}`, message });
    }
    return values;
  };
  return {
    answers: collect("booking", input.answers, "answers"),
    participants: input.participants.map(({ answers, ...participant }, index) => ({
      ...participant,
      answers: collect("participant", answers, `participants.${index}.answers`),
    })),
    issues,
  };
}

/**
 * Ce qu'un visiteur peut voir : les champs sans ceux marqués « interne » de « Ce que tu
 * décris », et seulement les valeurs des champs décrits visibles.
 */
export function publicFieldsView(
  fields: EventTypeField[],
  values: FieldValues,
): { fields: EventTypeField[]; fieldValues: FieldValues } {
  const visible = fields.filter(
    (field) => !(field.scope === "event" && field.visibility === "internal"),
  );
  const described = new Set(fieldsOfScope(visible, "event").map((field) => field.key));
  return {
    fields: visible,
    fieldValues: Object.fromEntries(Object.entries(values).filter(([key]) => described.has(key))),
  };
}
