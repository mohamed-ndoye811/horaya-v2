import { describe, expect, it } from "vitest";
import { type Control, validityMessage } from "./validity";

const valid: Control["validity"] = {
  valueMissing: false,
  typeMismatch: false,
  patternMismatch: false,
  tooShort: false,
  tooLong: false,
  rangeUnderflow: false,
  rangeOverflow: false,
  stepMismatch: false,
  badInput: false,
};

function control(
  type: string,
  invalid: Partial<Control["validity"]>,
  rest: Partial<Control> = {},
): Control {
  return { tagName: "INPUT", type, validity: { ...valid, ...invalid }, ...rest };
}

describe("validityMessage", () => {
  it("adapte le champ obligatoire au type de champ", () => {
    expect(validityMessage(control("text", { valueMissing: true }))).toBe(
      "Ce champ est obligatoire.",
    );
    expect(validityMessage(control("checkbox", { valueMissing: true }))).toBe(
      "Coche cette case pour continuer.",
    );
    expect(validityMessage(control("file", { valueMissing: true }))).toBe("Choisis un fichier.");
    expect(
      validityMessage({ ...control("select-one", { valueMissing: true }), tagName: "SELECT" }),
    ).toBe("Choisis une option.");
  });

  it("explique une adresse e-mail ou un lien mal écrits", () => {
    expect(validityMessage(control("email", { typeMismatch: true }))).toBe(
      "Cette adresse e-mail n'est pas valide.",
    );
    expect(validityMessage(control("url", { typeMismatch: true }))).toBe(
      "Ce lien n'est pas valide : il commence par https://.",
    );
  });

  it("donne les bornes d'un nombre", () => {
    expect(validityMessage(control("number", { rangeUnderflow: true }, { min: "2" }))).toBe(
      "Minimum : 2.",
    );
    expect(validityMessage(control("number", { rangeOverflow: true }, { max: "104" }))).toBe(
      "Maximum : 104.",
    );
    expect(validityMessage(control("number", { badInput: true }))).toBe("Indique un nombre.");
  });

  it("donne la longueur attendue", () => {
    expect(validityMessage(control("password", { tooShort: true }, { minLength: 8 }))).toBe(
      "Au moins 8 caractères.",
    );
  });

  it("reprend le titre d'un format imposé, sinon un message générique", () => {
    expect(
      validityMessage(control("text", { patternMismatch: true }, { title: "Lettres et tirets." })),
    ).toBe("Lettres et tirets.");
    expect(validityMessage(control("text", { stepMismatch: true }))).toBe(
      "Cette valeur n'est pas valide.",
    );
  });
});
