import { describe, expect, it } from "vitest";
import { z } from "zod";
import { ValidationError } from "./errors";
import { validate } from "./validate";

const schema = z.object({ title: z.string().min(1), capacity: z.number().int().positive() });

describe("validate", () => {
  it("retourne les données typées quand l'entrée est valide", () => {
    expect(validate(schema, { title: "Séminaire", capacity: 50 })).toEqual({
      title: "Séminaire",
      capacity: 50,
    });
  });

  it("lève une ValidationError avec le chemin de chaque problème", () => {
    try {
      validate(schema, { title: "", capacity: -1 });
      expect.unreachable();
    } catch (error) {
      expect(error).toBeInstanceOf(ValidationError);
      const paths = (error as ValidationError).issues.map((issue) => issue.path);
      expect(paths).toEqual(["title", "capacity"]);
    }
  });
});
