import { describe, expect, it } from "vitest";
import { generateToken, hashToken } from "./tokens";

describe("jetons", () => {
  it("génère des jetons uniques utilisables dans une URL", () => {
    const token = generateToken();
    expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(generateToken()).not.toBe(token);
  });

  it("produit une empreinte stable et différente du jeton", async () => {
    const token = generateToken();
    expect(await hashToken(token)).toBe(await hashToken(token));
    expect(await hashToken(token)).not.toBe(token);
  });
});
