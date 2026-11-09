import { describe, expect, it } from "vitest";
import { formatValidity } from "./validity";

describe("formatValidity", () => {
  it("parle en années, en mois, sinon en jours", () => {
    expect(formatValidity(365)).toBe("1 an");
    expect(formatValidity(730)).toBe("2 ans");
    expect(formatValidity(180)).toBe("6 mois");
    expect(formatValidity(45)).toBe("45 jours");
    expect(formatValidity(1)).toBe("1 jour");
  });
});
