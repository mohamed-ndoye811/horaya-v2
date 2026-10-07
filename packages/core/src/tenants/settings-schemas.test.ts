import { describe, expect, it } from "vitest";
import { updateTenantSettingsSchema } from "./settings-schemas";

describe("coordonnées de l'espace", () => {
  it("normalise le SIRET et l'e-mail, vide = non renseigné", () => {
    expect(
      updateTenantSettingsSchema.parse({
        contactEmail: " Contact@Cabinet-Vidal.fr ",
        siret: "123 456 789 00012",
        legalName: "",
      }),
    ).toEqual({
      contactEmail: "contact@cabinet-vidal.fr",
      siret: "12345678900012",
      legalName: null,
    });
    expect(updateTenantSettingsSchema.parse({ contactEmail: "", siret: "" })).toEqual({
      contactEmail: null,
      siret: null,
    });
  });

  it("refuse un SIRET incomplet", () => {
    const result = updateTenantSettingsSchema.safeParse({ siret: "1234" });
    expect(result.error?.issues[0]?.message).toBe("Le SIRET compte 14 chiffres");
  });

  it("ne touche pas aux champs absents (mise à jour partielle)", () => {
    expect(updateTenantSettingsSchema.parse({ contactPhone: "01 23 45 67 89" })).toEqual({
      contactPhone: "01 23 45 67 89",
    });
  });
});
