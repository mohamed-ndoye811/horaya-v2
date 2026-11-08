/**
 * Champs sur mesure (lot 33) : ce qu'un atelier décrit sur ses événements et ce qu'il demande
 * à l'inscription. Les formulaires et l'affichage sont générés à partir de ces définitions.
 */

/** Pas de type « fichier » : données de mineurs et de santé (RGPD). */
export const FIELD_TYPES = [
  "short_text",
  "long_text",
  "number",
  "boolean",
  "choice",
  "multi_choice",
  "date",
  "url",
  "acceptance",
] as const;
export type FieldType = (typeof FIELD_TYPES)[number];

/**
 * `event` : « Ce que tu décris », rempli sur chaque événement et affiché sur sa page.
 * `booking` et `participant` : « Ce que tu demandes », une fois par inscription ou pour
 * chaque participant.
 */
export const FIELD_SCOPES = ["event", "booking", "participant"] as const;
export type FieldScope = (typeof FIELD_SCOPES)[number];

export const FIELD_VISIBILITIES = ["public", "internal"] as const;
export type FieldVisibility = (typeof FIELD_VISIBILITIES)[number];

/** Types qui peuvent servir de condition d'affichage à un champ suivant. */
export const CONDITION_FIELD_TYPES: readonly FieldType[] = ["boolean", "choice", "multi_choice"];

/** Le champ n'apparaît que si un champ précédent vaut `equals` (ou le contient, choix multiple). */
export interface FieldCondition {
  fieldKey: string;
  equals: string | boolean;
}

/** Définition commune (matériel compris). */
export interface FieldDefinition {
  /** Clé stable des réponses (« niveau », « regime_alimentaire »). */
  key: string;
  /** Libellé ; pour une acceptation, le texte à côté de la case. */
  label: string;
  type: FieldType;
  required: boolean;
  /** Aide affichée sous le champ. */
  help?: string;
  /** Choix possibles (choix et choix multiple). */
  options?: string[];
  condition?: FieldCondition;
}

/** Champ d'un type d'événement. */
export interface EventTypeField extends FieldDefinition {
  scope: FieldScope;
  /** Portée `event` : « internal » reste dans l'équipe (pas sur la page publique). */
  visibility?: FieldVisibility;
  /** Portée `event`, champs à choix : sert de filtre sur la liste publique. */
  publicFilter?: boolean;
}

/**
 * Valeur enregistrée : texte (texte, choix, date AAAA-MM-JJ, lien), nombre, oui/non,
 * liste (choix multiple). Une acceptation enregistre l'instant où la case a été cochée (ISO).
 */
export type FieldValue = string | number | boolean | string[];
export type FieldValues = Record<string, FieldValue>;

/** Réponse brute, telle qu'elle arrive d'un formulaire ou d'une API. */
export type RawFieldValue = string | number | boolean | string[] | null;
export type RawFieldValues = Record<string, RawFieldValue>;
