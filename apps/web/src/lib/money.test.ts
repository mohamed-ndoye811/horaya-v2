import { describe, expect, it } from "vitest";
import { centsToInput, parseEuroToCents } from "./money";

describe("montants saisis", () => {
  it("accepte les écritures françaises et anglaises", () => {
    expect(parseEuroToCents("120,00")).toBe(12000);
    expect(parseEuroToCents("1 200,5 €")).toBe(120050);
    expect(parseEuroToCents("35.5")).toBe(3550);
    expect(parseEuroToCents("")).toBe(0);
  });

  it("refuse le reste", () => {
    expect(parseEuroToCents("12,345")).toBeNaN();
    expect(parseEuroToCents("abc")).toBeNaN();
  });

  it("pré-remplit un champ", () => {
    expect(centsToInput(12000)).toBe("120,00");
  });
});
