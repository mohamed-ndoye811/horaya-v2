import { describe, expect, it } from "vitest";
import { EVENT_TYPE_TEMPLATES } from "../events/templates";
import { ValidationError } from "../shared/errors";
import { fromLegacyCustomField } from "./legacy";
import type { EventTypeField, RawFieldValues } from "./model";
import { eventTypeFieldsSchema, itemFieldsSchema } from "./schemas";
import {
  isFieldShown,
  parseFieldValues,
  validateBookingAnswers,
  validateFieldValues,
} from "./values";

const now = new Date("2026-11-08T10:00:00Z");

const practised: EventTypeField = {
  key: "deja",
  label: "Tu as déjà tourné ?",
  type: "boolean",
  scope: "booking",
  required: true,
};
const since: EventTypeField = {
  key: "depuis",
  label: "Depuis combien de temps ?",
  type: "choice",
  scope: "booking",
  required: true,
  options: ["Moins d'un an", "Plus d'un an"],
  condition: { fieldKey: "deja", equals: true },
};
const rules: EventTypeField = {
  key: "reglement",
  label: "J'ai lu le règlement",
  type: "acceptance",
  scope: "booking",
  required: true,
};
const age: EventTypeField = {
  key: "age",
  label: "Âge",
  type: "number",
  scope: "participant",
  required: true,
};

describe("schéma des champs", () => {
  it("accepte les modèles fournis", () => {
    for (const template of EVENT_TYPE_TEMPLATES) {
      expect(eventTypeFieldsSchema.safeParse(template.fields).success, template.id).toBe(true);
    }
  });

  it("refuse une clé en double, un choix sans options, une acceptation à décrire", () => {
    const result = eventTypeFieldsSchema.safeParse([
      { ...practised, key: "a" },
      { ...practised, key: "a" },
      { key: "niveau", label: "Niveau", type: "choice", scope: "event", required: false },
      { ...rules, scope: "event" },
    ]);
    expect(result.success).toBe(false);
    expect(result.error?.issues.map((issue) => issue.path[0])).toEqual([1, 2, 3]);
  });

  it("veut une condition sur un champ précédent de la même portée, avec une réponse possible", () => {
    expect(eventTypeFieldsSchema.safeParse([practised, since]).success).toBe(true);
    // Le champ visé vient après.
    expect(eventTypeFieldsSchema.safeParse([since, practised]).success).toBe(false);
    // Autre portée.
    expect(
      eventTypeFieldsSchema.safeParse([{ ...practised, scope: "participant" }, since]).success,
    ).toBe(false);
    // Oui / non attend un booléen.
    expect(
      eventTypeFieldsSchema.safeParse([
        practised,
        { ...since, condition: { fieldKey: "deja", equals: "oui" } },
      ]).success,
    ).toBe(false);
  });

  it("réserve visibilité et filtre public à « Ce que tu décris », le filtre aux choix", () => {
    expect(
      eventTypeFieldsSchema.safeParse([{ ...practised, visibility: "internal" }]).success,
    ).toBe(false);
    expect(
      eventTypeFieldsSchema.safeParse([
        {
          key: "terre",
          label: "Terre",
          type: "short_text",
          scope: "event",
          required: false,
          publicFilter: true,
        },
      ]).success,
    ).toBe(false);
  });

  it("champs du matériel : une seule portée, pas d'acceptation", () => {
    expect(
      itemFieldsSchema.safeParse([
        { key: "watts", label: "Puissance", type: "number", required: false },
      ]).success,
    ).toBe(true);
    expect(itemFieldsSchema.safeParse([{ ...rules, scope: undefined }]).success).toBe(false);
  });
});

describe("conditions d'affichage", () => {
  it("compare la réponse, ou la cherche dans un choix multiple", () => {
    expect(isFieldShown(since, { deja: true })).toBe(true);
    expect(isFieldShown(since, { deja: false })).toBe(false);
    expect(isFieldShown(since, {})).toBe(false);
    const multi = { ...since, condition: { fieldKey: "techniques", equals: "Tour" } };
    expect(isFieldShown(multi, { techniques: ["Modelage", "Tour"] })).toBe(true);
    expect(isFieldShown({ ...practised }, {})).toBe(true);
  });
});

describe("validation des réponses", () => {
  it("convertit les réponses d'un formulaire", () => {
    const fields = [
      practised,
      { ...age, scope: "booking" as const },
      {
        key: "jour",
        label: "Jour",
        type: "date" as const,
        scope: "booking" as const,
        required: false,
      },
      {
        key: "techniques",
        label: "Techniques",
        type: "multi_choice" as const,
        scope: "booking" as const,
        required: false,
        options: ["Tour", "Modelage"],
      },
    ];
    const { values, errors } = parseFieldValues(
      fields,
      { deja: "false", age: "12,5", jour: "2026-12-01", techniques: ["Tour", "Tour"] },
      { now },
    );
    expect(errors).toEqual({});
    expect(values).toEqual({ deja: false, age: 12.5, jour: "2026-12-01", techniques: ["Tour"] });
  });

  it("signale requis, choix inconnu, date, lien et nombre invalides", () => {
    const { errors } = parseFieldValues(
      [
        practised,
        { ...since, condition: undefined },
        { key: "jour", label: "Jour", type: "date", required: false },
        { key: "site", label: "Site", type: "url", required: false },
        { key: "n", label: "N", type: "number", required: false },
      ],
      { depuis: "Toujours", jour: "2026-02-30", site: "javascript:alert(1)", n: "douze" },
      { now },
    );
    expect(errors).toEqual({
      deja: "Requis",
      depuis: "Choix inconnu",
      jour: "Date invalide",
      site: "Adresse invalide (https://…)",
      n: "Nombre attendu",
    });
  });

  it("ignore un champ masqué par sa condition, et jette sa réponse", () => {
    const hidden = parseFieldValues(
      [practised, since],
      { deja: "false", depuis: "Plus d'un an" },
      { now },
    );
    expect(hidden).toEqual({ values: { deja: false }, errors: {} });
    const shown = parseFieldValues([practised, since], { deja: "on" }, { now });
    expect(shown.errors).toEqual({ depuis: "Requis" });
  });

  it("horodate une acceptation et conserve une acceptation déjà horodatée", () => {
    expect(parseFieldValues([rules], { reglement: "on" }, { now }).values).toEqual({
      reglement: now.toISOString(),
    });
    const earlier = "2026-10-01T08:00:00.000Z";
    expect(parseFieldValues([rules], { reglement: earlier }, { now }).values).toEqual({
      reglement: earlier,
    });
    expect(parseFieldValues([rules], {}, { now }).errors).toEqual({
      reglement: "Coche la case pour continuer",
    });
  });

  it("laisse l'équipe saisir sans les champs requis", () => {
    expect(parseFieldValues([practised, rules], {}, { now, enforceRequired: false })).toEqual({
      values: {},
      errors: {},
    });
  });

  it("lève une ValidationError avec le chemin de chaque réponse", () => {
    try {
      validateFieldValues([practised], {}, { now }, "fieldValues");
      expect.unreachable();
    } catch (error) {
      expect(error).toBeInstanceOf(ValidationError);
      expect((error as ValidationError).issues).toEqual([
        { path: "fieldValues.deja", message: "Requis" },
      ]);
    }
  });

  it("valide les questions « une fois » puis celles de chaque participant", () => {
    const participants: Array<{ firstName: string; answers: RawFieldValues }> = [
      { firstName: "Léa", answers: { age: "14" } },
      { firstName: "", answers: {} },
    ];
    const result = validateBookingAnswers(
      [practised, since, age],
      { answers: { deja: "true", depuis: "Plus d'un an" }, participants },
      { now },
    );
    expect(result.answers).toEqual({ deja: true, depuis: "Plus d'un an" });
    expect(result.participants).toEqual([
      { firstName: "Léa", answers: { age: 14 } },
      { firstName: "", answers: {} },
    ]);
    expect(result.issues).toEqual([{ path: "participants.1.answers.age", message: "Requis" }]);
  });
});

describe("reprise des anciens champs personnalisés", () => {
  it("texte, choix et case deviennent des questions « une fois par inscription »", () => {
    expect(
      fromLegacyCustomField({
        key: "entreprise",
        label: "Entreprise",
        type: "text",
        required: true,
      }),
    ).toEqual({
      key: "entreprise",
      label: "Entreprise",
      type: "short_text",
      scope: "booking",
      required: true,
    });
    expect(
      fromLegacyCustomField({
        key: "regime",
        label: "Régime",
        type: "select",
        required: false,
        options: ["Végétarien"],
      }),
    ).toMatchObject({ type: "choice", options: ["Végétarien"], scope: "booking" });
    expect(
      fromLegacyCustomField({
        key: "photo",
        label: "Droit à l'image",
        type: "checkbox",
        required: false,
      }),
    ).toMatchObject({ type: "boolean", scope: "booking" });
    // Le résultat reste un champ valide.
    expect(
      eventTypeFieldsSchema.safeParse([
        fromLegacyCustomField({
          key: "regime",
          label: "Régime",
          type: "select",
          required: false,
          options: ["A"],
        }),
      ]).success,
    ).toBe(true);
  });
});
