import { describe, expect, it } from "vitest";
import { backLink, isFormPage } from "./mobile-nav";

describe("backLink", () => {
  it("affiche le logo sur les écrans des onglets", () => {
    for (const path of [
      "/app",
      "/app/calendrier",
      "/app/evenements",
      "/app/reservations",
      "/app/plus",
    ]) {
      expect(backLink(path)).toBeNull();
    }
  });

  it("ramène une fiche à sa liste", () => {
    expect(backLink("/app/evenements/abc")).toEqual({
      href: "/app/evenements",
      label: "Événements",
    });
    expect(backLink("/app/evenements/types")).toEqual({
      href: "/app/evenements",
      label: "Événements",
    });
    expect(backLink("/app/reservations/nouvelle")).toEqual({
      href: "/app/reservations",
      label: "Réservations",
    });
  });

  it("ramène un formulaire à sa fiche", () => {
    expect(backLink("/app/evenements/abc/modifier")).toEqual({
      href: "/app/evenements/abc",
      label: "Événement",
    });
    expect(backLink("/app/materiel/abc/louer")).toEqual({
      href: "/app/materiel/abc",
      label: "Article",
    });
  });

  it("ramène le matériel, les clients et les paramètres à « Plus »", () => {
    expect(backLink("/app/materiel")).toEqual({ href: "/app/plus", label: "Plus" });
    expect(backLink("/app/clients")).toEqual({ href: "/app/plus", label: "Plus" });
    expect(backLink("/app/parametres/membres")).toEqual({ href: "/app/plus", label: "Paramètres" });
  });
});

describe("isFormPage", () => {
  it("repère les formulaires de création et de modification", () => {
    expect(isFormPage("/app/evenements/nouveau")).toBe(true);
    expect(isFormPage("/app/reservations/nouvelle")).toBe(true);
    expect(isFormPage("/app/clients/abc/modifier")).toBe(true);
    expect(isFormPage("/app/materiel/abc/louer")).toBe(true);
    expect(isFormPage("/app/evenements/abc")).toBe(false);
  });
});
