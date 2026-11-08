import type { EventTypeField } from "./model";

/** Champ personnalisé d'avant le lot 33 (`event_type.custom_fields`). */
export interface LegacyCustomField {
  key: string;
  label: string;
  type: "text" | "select" | "checkbox";
  required: boolean;
  options?: string[];
}

const LEGACY_TYPES = { text: "short_text", select: "choice", checkbox: "boolean" } as const;

/**
 * Ancien champ → champ « Ce que tu demandes », une fois par inscription. Référence de la
 * reprise de données de la migration 0021 (même conversion, en SQL).
 */
export function fromLegacyCustomField(field: LegacyCustomField): EventTypeField {
  return {
    key: field.key,
    label: field.label,
    type: LEGACY_TYPES[field.type],
    scope: "booking",
    required: field.required,
    ...(field.type === "select" ? { options: field.options ?? [] } : {}),
  };
}
