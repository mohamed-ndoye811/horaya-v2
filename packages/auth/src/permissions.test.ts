import { describe, expect, it } from "vitest";
import { roles } from "./permissions";

describe("rôles d'un espace", () => {
  it("réserve la facturation au propriétaire", () => {
    expect(roles.owner.authorize({ billing: ["manage"] }).success).toBe(true);
    expect(roles.admin.authorize({ billing: ["manage"] }).success).toBe(false);
  });

  it("laisse l'administrateur gérer les réglages et l'équipe", () => {
    expect(roles.admin.authorize({ settings: ["update"], member: ["create"] }).success).toBe(true);
  });

  it("limite l'éditeur à l'activité quotidienne", () => {
    expect(roles.editor.authorize({ event: ["publish"], booking: ["cancel"] }).success).toBe(true);
    expect(roles.editor.authorize({ settings: ["update"] }).success).toBe(false);
    expect(roles.editor.authorize({ booking: ["refund"] }).success).toBe(false);
  });

  it("ne donne aucune action au lecteur", () => {
    expect(roles.viewer.authorize({ event: ["create"] }).success).toBe(false);
  });
});
