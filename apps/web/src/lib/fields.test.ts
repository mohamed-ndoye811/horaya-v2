import type { EventTypeField } from "@horaya/core";
import { describe, expect, it } from "vitest";
import { type AnswersOfBooking, answerColumns, answerGroups } from "./fields";

const fields: EventTypeField[] = [
  {
    key: "niveau",
    label: "Niveau",
    type: "choice",
    options: ["Débutant"],
    required: true,
    scope: "booking",
  },
  {
    key: "allergie",
    label: "Allergies",
    type: "short_text",
    required: false,
    scope: "participant",
  },
  {
    key: "interne",
    label: "Note interne",
    type: "short_text",
    required: false,
    scope: "event",
    visibility: "internal",
  },
];
const booking: AnswersOfBooking = {
  fields,
  answers: { niveau: "Débutant", interne: "secret", ancien: "x" },
  participants: [
    { firstName: "Léa", lastName: "Roy", answers: { allergie: "Noix" } },
    { firstName: "", lastName: "", answers: {} },
  ],
};

describe("réponses aux questions du type", () => {
  it("groupes pour l'e-mail : ni champ interne, ni champ retiré, ni participant sans réponse", () => {
    expect(answerGroups(booking)).toEqual([
      { title: null, rows: [{ key: "niveau", label: "Niveau", value: "Débutant" }] },
      { title: "Léa Roy", rows: [{ key: "allergie", label: "Allergies", value: "Noix" }] },
    ]);
  });

  it("colonnes de l'export : une par question, participants dans la cellule", () => {
    const columns = answerColumns([booking, { fields: [], answers: {}, participants: [] }]);
    expect(columns.headers).toEqual(["Niveau", "Allergies (par participant)"]);
    expect(columns.cells(0)).toEqual(["Débutant", "Léa Roy : Noix"]);
    expect(columns.cells(1)).toEqual(["", ""]);
  });
});
