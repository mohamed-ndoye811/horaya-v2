import { describe, expect, it } from "vitest";
import { ValidationError } from "../shared/errors";
import { assertAcceptablePassword, checkPassword } from "./password";

describe("checkPassword", () => {
  it("juge faible un mot de passe trop court", () => {
    const check = checkPassword("Court1!");
    expect(check.acceptable).toBe(false);
    expect(check.strength).toBe("faible");
  });

  it("accepte un mot de passe sans caractère spécial, jugé correct", () => {
    const check = checkPassword("PlanifieAvec2026");
    expect(check.acceptable).toBe(true);
    expect(check.strength).toBe("correct");
    expect(check.score).toBe(3);
  });

  it("juge robuste un mot de passe qui respecte toutes les règles", () => {
    const check = checkPassword("Planifie-Avec-2026");
    expect(check.strength).toBe("robuste");
    expect(check.score).toBe(4);
  });

  it("reconnaît les majuscules accentuées", () => {
    expect(checkPassword("étéÉTÉ2026abcd").acceptable).toBe(true);
  });

  it("refuse un mot de passe sans chiffre même long", () => {
    expect(checkPassword("PlanifieAvecStyle").acceptable).toBe(false);
  });
});

describe("assertAcceptablePassword", () => {
  it("liste les règles manquantes", () => {
    try {
      assertAcceptablePassword("planifieavecstyle");
      expect.unreachable();
    } catch (error) {
      expect(error).toBeInstanceOf(ValidationError);
      expect((error as ValidationError).issues.map((issue) => issue.message)).toEqual([
        "Une majuscule et une minuscule",
        "Au moins un chiffre",
      ]);
    }
  });
});
