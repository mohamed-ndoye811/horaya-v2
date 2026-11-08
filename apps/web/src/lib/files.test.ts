import { describe, expect, it } from "vitest";
import { FILE_KEY } from "./files";

describe("FILE_KEY", () => {
  const id = "0f3c2a4e-5b6d-4e7f-8a9b-0c1d2e3f4a5b";
  it("accepte les clés rangées par l'app", () => {
    expect(FILE_KEY.test(`org_123/articles/${id}.webp`)).toBe(true);
    expect(FILE_KEY.test(`user-9/profils/${id}.png`)).toBe(true);
    expect(FILE_KEY.test(`org_123/couvertures/${id}.jpg`)).toBe(true);
    expect(FILE_KEY.test(`org_123/documents/${id}.pdf`)).toBe(true);
  });
  it("refuse les chemins détournés et les fichiers inattendus", () => {
    expect(FILE_KEY.test(`../articles/${id}.webp`)).toBe(false);
    expect(FILE_KEY.test(`org/../../secret/${id}.webp`)).toBe(false);
    expect(FILE_KEY.test(`org/factures/${id}.webp`)).toBe(false);
    expect(FILE_KEY.test(`org/articles/${id}.svg`)).toBe(false);
    expect(FILE_KEY.test(`org/articles/${id}.webp?x=1`)).toBe(false);
    expect(FILE_KEY.test(`org/articles/${id}.pdf`)).toBe(false);
    expect(FILE_KEY.test(`org/documents/${id}.webp`)).toBe(false);
  });
});
