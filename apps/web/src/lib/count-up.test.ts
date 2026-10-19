import { describe, expect, it } from "vitest";
import { splitCount } from "./count-up";

describe("splitCount", () => {
  it("garde le texte autour du nombre", () => {
    expect(splitCount("1 240 €")).toEqual({ before: "", target: 1240, after: " €" });
    expect(splitCount("+12 %")).toEqual({ before: "+", target: 12, after: " %" });
    expect(splitCount("3 / 8")).toEqual({ before: "", target: 3, after: " / 8" });
  });

  it("ne fait rien défiler sans nombre, à zéro ou avec des décimales", () => {
    expect(splitCount("Gratuit")).toBeNull();
    expect(splitCount("0")).toBeNull();
    expect(splitCount("45,00 €")).toBeNull();
  });
});
