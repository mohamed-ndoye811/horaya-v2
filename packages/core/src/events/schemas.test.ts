import { describe, expect, it } from "vitest";
import { updateEventSchema } from "./schemas";

describe("updateEventSchema", () => {
  it("ne touche qu'aux champs fournis (pas de valeurs par défaut)", () => {
    expect(updateEventSchema.parse({ capacity: 3 })).toEqual({ capacity: 3 });
  });
});
