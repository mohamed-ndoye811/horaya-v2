import { describe, expect, it } from "vitest";
import { meshCover, seedOf } from "./cover";

describe("meshCover", () => {
  it("donne toujours la même composition pour un même événement", () => {
    expect(meshCover("#528d74", "evt-1")).toEqual(meshCover("#528d74", "evt-1"));
    expect(seedOf("abc")).toBe(seedOf("abc"));
  });

  it("part de la couleur donnée, variable CSS comprise", () => {
    const style = meshCover("var(--brand)", "x");
    expect(style.backgroundColor).toContain("from var(--brand)");
    expect(String(style.backgroundImage).split("radial-gradient")).toHaveLength(4);
  });
});
