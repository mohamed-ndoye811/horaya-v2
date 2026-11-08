import { z } from "zod";
import {
  CONDITION_FIELD_TYPES,
  FIELD_SCOPES,
  FIELD_TYPES,
  FIELD_VISIBILITIES,
  type FieldDefinition,
} from "./model";

const fieldKeySchema = z
  .string()
  .regex(/^[a-z][a-z0-9_]{0,39}$/, "Clé en minuscules, chiffres et _");

const fieldShape = {
  key: fieldKeySchema,
  label: z.string().trim().min(1, "Libellé requis").max(200),
  type: z.enum(FIELD_TYPES),
  required: z.boolean(),
  help: z
    .string()
    .trim()
    .max(300)
    .optional()
    .transform((value) => value || undefined),
  options: z.array(z.string().trim().min(1).max(80)).max(30).optional(),
  condition: z
    .object({ fieldKey: fieldKeySchema, equals: z.union([z.string().max(80), z.boolean()]) })
    .optional(),
};

/**
 * Cohérence d'une liste de champs : clés uniques, choix renseignés, condition sur un champ
 * précédent de la même portée (oui/non ou choix), réglages réservés à « Ce que tu décris ».
 */
function checkFields(
  fields: Array<FieldDefinition & { scope?: string; visibility?: string; publicFilter?: boolean }>,
  context: z.RefinementCtx,
) {
  const issue = (index: number, message: string) =>
    context.addIssue({ code: "custom", path: [index], message });
  fields.forEach((field, index) => {
    const name = `« ${field.label} »`;
    const previous = fields.slice(0, index);
    if (previous.some((other) => other.key === field.key)) {
      issue(index, `Deux champs ont la clé ${field.key}`);
    }
    const choices = field.type === "choice" || field.type === "multi_choice";
    const options = field.options ?? [];
    if (choices && options.length === 0) issue(index, `Indique les choix de ${name}`);
    if (new Set(options).size !== options.length) {
      issue(index, `Un choix apparaît deux fois dans ${name}`);
    }
    const describes = field.scope === undefined || field.scope === "event";
    if (describes && field.type === "acceptance") {
      issue(index, `Une acceptation se demande à l'inscription, pas ici (${name})`);
    }
    if (field.scope !== "event" && (field.visibility || field.publicFilter)) {
      issue(index, `Visibilité et filtre public ne valent que pour « Ce que tu décris »`);
    }
    if (field.publicFilter && !choices) issue(index, `Seul un champ à choix sert de filtre`);
    if (field.condition) {
      const target = previous.find(
        (other) => other.key === field.condition?.fieldKey && other.scope === field.scope,
      );
      if (!target || !CONDITION_FIELD_TYPES.includes(target.type)) {
        issue(index, `${name} dépend d'un champ précédent à choix ou oui / non`);
      } else if (
        target.type === "boolean"
          ? typeof field.condition.equals !== "boolean"
          : !target.options?.includes(String(field.condition.equals))
      ) {
        issue(index, `La condition de ${name} ne correspond à aucune réponse possible`);
      }
    }
  });
}

/** Champs d'un type d'événement (les cinq sections : 3 et 4 ici). */
export const eventTypeFieldsSchema = z
  .array(
    z.object({
      ...fieldShape,
      scope: z.enum(FIELD_SCOPES),
      visibility: z.enum(FIELD_VISIBILITIES).optional(),
      publicFilter: z.boolean().optional(),
    }),
  )
  .max(40)
  .superRefine(checkFields);

/** Champs d'une catégorie de matériel (une seule portée : l'article). */
export const itemFieldsSchema = z.array(z.object(fieldShape)).max(20).superRefine(checkFields);

/** Réponses brutes envoyées par un formulaire : validées ensuite contre les définitions. */
export const rawFieldValuesSchema = z.record(
  z.string().max(40),
  z.union([
    z.string().max(5000),
    z.number(),
    z.boolean(),
    z.array(z.string().max(80)).max(30),
    z.null(),
  ]),
);
