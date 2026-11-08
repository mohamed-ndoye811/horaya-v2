import type {
  BookingNoun,
  FieldDefinition,
  FieldType,
  FieldValue,
  RawFieldValues,
} from "@horaya/core";

export const FIELD_TYPE_LABELS: Record<FieldType, string> = {
  short_text: "Texte court",
  long_text: "Texte long",
  number: "Nombre",
  boolean: "Oui / non",
  choice: "Choix",
  multi_choice: "Choix multiple",
  date: "Date",
  url: "Lien",
  acceptance: "Acceptation",
};

/** Nom des réservations d'un type : « 3 inscriptions », « Je m'inscris », « Confirmer mon inscription ». */
export const BOOKING_NOUN_LABELS: Record<
  BookingNoun,
  { singular: string; plural: string; action: string; confirm: string; title: string }
> = {
  reservation: {
    singular: "réservation",
    plural: "réservations",
    action: "Réserver mes places",
    confirm: "Confirmer ma réservation",
    title: "Réserve tes places",
  },
  inscription: {
    singular: "inscription",
    plural: "inscriptions",
    action: "Je m'inscris",
    confirm: "Confirmer mon inscription",
    title: "Inscris-toi",
  },
  location: {
    singular: "location",
    plural: "locations",
    action: "Je loue",
    confirm: "Confirmer ma location",
    title: "Réserve ta location",
  },
  demande: {
    singular: "demande",
    plural: "demandes",
    action: "Je fais une demande",
    confirm: "Envoyer ma demande",
    title: "Fais ta demande",
  },
};

/** Valeur enregistrée → texte lisible (« Oui », « 12 déc. 2026 », « Accepté le … »). */
export function formatFieldValue(
  field: FieldDefinition | undefined,
  value: FieldValue,
  timeZone = "Europe/Paris",
): string {
  if (Array.isArray(value)) return value.join(", ");
  if (typeof value === "boolean") return value ? "Oui" : "Non";
  if (typeof value === "number") return value.toLocaleString("fr-FR");
  const day = { day: "numeric", month: "short", year: "numeric" } as const;
  if (field?.type === "date") {
    // Date civile : lue à midi UTC, elle reste le même jour dans tous les fuseaux.
    return new Date(`${value}T12:00:00Z`).toLocaleDateString("fr-FR", day);
  }
  if (field?.type === "acceptance") {
    const at = new Date(value);
    return `Accepté le ${at.toLocaleDateString("fr-FR", { ...day, timeZone })} à ${at.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit", timeZone })}`;
  }
  return value;
}

/**
 * Lignes « libellé : valeur » des réponses, dans l'ordre des champs. Une clé sans champ
 * (champ retiré depuis) reste affichée avec sa clé : aucune réponse ne disparaît.
 */
export function answerRows(
  fields: FieldDefinition[],
  values: Record<string, FieldValue>,
  timeZone?: string,
): Array<{ key: string; label: string; value: string }> {
  const known = fields
    .filter((field) => values[field.key] !== undefined)
    .map((field) => ({
      key: field.key,
      label: field.label,
      value: formatFieldValue(field, values[field.key] as FieldValue, timeZone),
    }));
  const orphans = Object.entries(values)
    .filter(([key]) => !fields.some((field) => field.key === key))
    .map(([key, value]) => ({
      key,
      label: key,
      value: formatFieldValue(undefined, value, timeZone),
    }));
  return [...known, ...orphans];
}

/**
 * Réponses brutes d'un formulaire envoyé : chaque champ nommé `${prefix}${clé}` (plusieurs
 * cases cochées donnent une liste). Le core les valide contre les définitions.
 */
export function rawFieldValues(form: FormData, prefix: string): RawFieldValues {
  const raw: RawFieldValues = {};
  for (const name of new Set(form.keys())) {
    if (!name.startsWith(prefix)) continue;
    const values = form.getAll(name).filter((value): value is string => typeof value === "string");
    raw[name.slice(prefix.length)] = values.length > 1 ? values : (values[0] ?? null);
  }
  return raw;
}
