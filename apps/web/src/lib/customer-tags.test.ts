import { describe, expect, it } from "vitest";
import { customerTags } from "./customer-tags";

const now = new Date("2026-10-07T12:00:00Z");
const base = {
  tags: [],
  company: null,
  bookings: 1,
  createdAt: new Date("2026-01-01T00:00:00Z"),
  lastVisit: new Date("2026-09-01T00:00:00Z"),
  nextVisit: null,
};

describe("customerTags", () => {
  it("déduit VIP, entreprise et nouveau", () => {
    expect(
      customerTags({ ...base, bookings: 6, company: "Cabinet Vidal" }, now).map((tag) => tag.label),
    ).toEqual(["VIP", "Entreprise"]);
    expect(
      customerTags({ ...base, createdAt: new Date("2026-10-01T00:00:00Z") }, now).map(
        (tag) => tag.label,
      ),
    ).toEqual(["Nouveau"]);
  });

  it("marque inactif sans activité depuis six mois", () => {
    expect(
      customerTags({ ...base, lastVisit: new Date("2026-02-01T00:00:00Z") }, now).map(
        (tag) => tag.label,
      ),
    ).toEqual(["Inactif"]);
  });

  it("garde les étiquettes posées par l'équipe, sans doublon", () => {
    expect(
      customerTags({ ...base, tags: ["VIP", "traiteur"] }, now).map((tag) => tag.label),
    ).toEqual(["VIP", "traiteur"]);
  });
});
