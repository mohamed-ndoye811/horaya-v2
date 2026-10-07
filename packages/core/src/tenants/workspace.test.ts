import { describe, expect, it } from "vitest";
import { createWorkspaceSchema, slugify, slugSchema } from "./workspace";

describe("slugify", () => {
  it("retire accents, ponctuation et espaces", () => {
    expect(slugify("  Cabinet Vidal & Fils — Été ")).toBe("cabinet-vidal-fils-ete");
  });

  it("ne laisse pas de tiret final après troncature", () => {
    const slug = slugify(`${"a".repeat(47)} b`);
    expect(slug.endsWith("-")).toBe(false);
    expect(slug.length).toBeLessThanOrEqual(48);
  });
});

describe("slugSchema", () => {
  it("refuse une adresse réservée par l'application", () => {
    expect(slugSchema.safeParse("connexion").success).toBe(false);
  });

  it("refuse les majuscules et les tirets doublés", () => {
    expect(slugSchema.safeParse("Cabinet").success).toBe(false);
    expect(slugSchema.safeParse("cabinet--vidal").success).toBe(false);
  });

  it("accepte une adresse simple", () => {
    expect(slugSchema.safeParse("cabinet-vidal").success).toBe(true);
  });
});

describe("createWorkspaceSchema", () => {
  it("normalise la couleur de marque en majuscules", () => {
    const parsed = createWorkspaceSchema.parse({
      name: "Cabinet Vidal",
      slug: "cabinet-vidal",
      sector: "consulting",
      brandColor: "#528d74",
    });
    expect(parsed.brandColor).toBe("#528D74");
  });
});
