import { describe, expect, it } from "vitest";
import { colorFor, textOn } from "./colors";

describe("textOn", () => {
  it("met du texte clair sur les teintes foncées", () => {
    expect(textOn("#528D74")).toBe("#F7F5F3");
    expect(textOn("#264489")).toBe("#F7F5F3");
  });

  it("assombrit la teinte pour les fonds clairs (comme la maquette)", () => {
    expect(textOn("#D8BC66")).toBe("#2B2614");
    expect(textOn("#CF879C")).toBe("#291B1F");
  });
});

describe("colorFor", () => {
  it("donne toujours la même couleur pour un même nom", () => {
    expect(colorFor("Léa Fontaine")).toBe(colorFor("Léa Fontaine"));
  });
});
