import { describe, expect, it } from "vitest";
import { ConflictError, ValidationError } from "../shared/errors";
import {
  type EquipmentNeed,
  equipmentModuleSchema,
  eventTypeModulesSchema,
  locationModuleSchema,
} from "./registry";
import {
  CLIENT_ADDRESS_FIELD_KEY,
  CLIENT_SITE_LABEL,
  type EquipmentUnit,
  equipmentCandidates,
  eventPlace,
  optionNeedSeats,
  planEquipment,
  staffAllowed,
} from "./resources";
import { publicModules, withModuleFields } from "./rules";

const TYPE = "11111111-1111-4111-8111-111111111111";
const period = {
  startsAt: new Date("2026-12-10T18:00:00Z"),
  endsAt: new Date("2026-12-10T20:00:00Z"),
};
const unit = (
  id: string,
  label: string,
  name = "Tour Shimpo",
  details: string[] = [],
): EquipmentUnit => ({
  id,
  label,
  status: "available",
  itemId: `item-${name}`,
  itemName: name,
  details,
});
const tour = (over: Partial<EquipmentNeed> = {}): EquipmentNeed => ({
  id: "tour",
  itemTypeId: TYPE,
  perSeat: 1,
  required: true,
  chooser: "workshop",
  ...over,
});
const free = (...units: EquipmentUnit[]) => units.map((entry) => ({ unit: entry }));
const names = { tour: "Tour", tablier: "Tablier" };

describe("besoins en matériel", () => {
  const u1 = unit("u1", "#1");
  const u2 = unit("u2", "#2");
  const u3 = unit("u3", "#3");

  it("obligatoire attribué par l'atelier : une unité par place, les premières libres", () => {
    const plan = planEquipment({
      needs: [tour()],
      seats: 2,
      choices: [],
      candidates: { tour: free(u1, u2, u3) },
      names,
      byTeam: false,
    });
    expect(plan.map((entry) => entry.unit.id)).toEqual(["u1", "u2"]);
  });

  it("obligatoire : refus s'il ne reste pas assez d'unités", () => {
    expect(() =>
      planEquipment({
        needs: [tour()],
        seats: 3,
        choices: [],
        candidates: { tour: free(u1, u2) },
        names,
        byTeam: false,
      }),
    ).toThrow(ConflictError);
    expect(() =>
      planEquipment({
        needs: [tour()],
        seats: 1,
        choices: [],
        candidates: { tour: [] },
        names,
        byTeam: false,
      }),
    ).toThrow("Plus de tour disponible");
  });

  it("facultatif : rien sans la case cochée, une unité par place avec", () => {
    const needs = [tour({ id: "tablier", required: false })];
    const candidates = { tablier: free(u1, u2) };
    const none = planEquipment({ needs, seats: 2, choices: [], candidates, names, byTeam: false });
    expect(none).toEqual([]);
    const wanted = planEquipment({
      needs,
      seats: 2,
      choices: [{ needId: "tablier", wanted: true }],
      candidates,
      names,
      byTeam: false,
    });
    expect(wanted).toHaveLength(2);
  });

  it("option liée : elle remplace la case, une unité par place qui la prend", () => {
    const needs = [tour({ id: "tablier", required: false })];
    const candidates = { tablier: free(u1, u2, u3) };
    const event = (per: "participant" | "booking") => ({
      paymentMode: "online",
      modules: {
        equipment: { needs },
        pricing: {
          rates: [{ id: "plein", name: "Plein", priceCents: 4500 }],
          options: [{ id: "tab", name: "Tablier", priceCents: 500, per, needId: "tablier" }],
        },
      },
    });
    const lines = (quantity: number) => [{ kind: "option", id: "tab", quantity }];
    // Par participant : deux places sur trois prennent le tablier.
    expect(optionNeedSeats(event("participant"), 3, lines(2))).toEqual({ tablier: 2 });
    // Par inscription : toutes les places, dès que l'option est prise.
    expect(optionNeedSeats(event("booking"), 3, lines(1))).toEqual({ tablier: 3 });
    expect(optionNeedSeats(event("booking"), 3, [])).toEqual({ tablier: 0 });
    // Événement gratuit : pas d'option, la case reste.
    expect(optionNeedSeats({ ...event("booking"), paymentMode: "free" }, 3, lines(1))).toEqual({});

    const plan = (linked: Record<string, number>, wanted = false) =>
      planEquipment({
        needs,
        seats: 3,
        choices: [{ needId: "tablier", wanted }],
        candidates,
        names,
        byTeam: false,
        linked,
      });
    expect(plan({ tablier: 2 })).toHaveLength(2);
    // Sans l'option, la case cochée ne réserve rien : le matériel payant passe par l'option.
    expect(plan({ tablier: 0 }, true)).toEqual([]);
  });

  it("option liée : un besoin facultatif du module, une seule option, prise une fois", () => {
    const modules = (needId: string, over: Partial<EquipmentNeed> = {}, max?: number) => ({
      equipment: { needs: [tour({ id: "tablier", required: false, ...over })] },
      pricing: {
        rates: [{ id: "plein", name: "Plein", priceCents: 4500 }],
        options: [{ id: "tab", name: "Tablier", priceCents: 500, per: "participant", needId, max }],
      },
    });
    const issue = (value: unknown) =>
      eventTypeModulesSchema.safeParse(value).error?.issues[0]?.message ?? null;
    expect(issue(modules("tablier"))).toBeNull();
    expect(issue(modules("inconnu"))).toMatch(/pas dans le module/);
    expect(issue(modules("tablier", { required: true }))).toMatch(/obligatoire/);
    expect(issue(modules("tablier", {}, 3))).toMatch(/une fois/);
  });

  it("l'élève choisit : il désigne exactement la quantité, parmi les unités libres", () => {
    const needs = [tour({ chooser: "student" })];
    const base = { needs, seats: 1, candidates: { tour: free(u1, u2) }, names, byTeam: false };
    expect(() => planEquipment({ ...base, choices: [] })).toThrow(ValidationError);
    const plan = planEquipment({ ...base, choices: [{ needId: "tour", unitIds: ["u2"] }] });
    expect(plan.map((entry) => entry.unit.id)).toEqual(["u2"]);
    // Une unité indisponible (déjà prise, hors restriction) ne passe pas.
    expect(() =>
      planEquipment({ ...base, choices: [{ needId: "tour", unitIds: ["u3"] }] }),
    ).toThrow(ConflictError);
    // Deux fois la même unité pour deux places : refus.
    expect(() =>
      planEquipment({ ...base, seats: 2, choices: [{ needId: "tour", unitIds: ["u1", "u1"] }] }),
    ).toThrow(ValidationError);
  });

  it("jamais deux fois la même unité, même pour deux besoins de la même catégorie", () => {
    const plan = planEquipment({
      needs: [tour(), tour({ id: "tablier" })],
      seats: 1,
      choices: [],
      candidates: { tour: free(u1, u2), tablier: free(u1, u2) },
      names,
      byTeam: false,
    });
    expect(new Set(plan.map((entry) => entry.unit.id)).size).toBe(2);
  });

  it("l'équipe n'a jamais à choisir : le besoin « l'élève choisit » est attribué", () => {
    const plan = planEquipment({
      needs: [tour({ chooser: "student" })],
      seats: 1,
      choices: [],
      candidates: { tour: free(u1) },
      names,
      byTeam: true,
    });
    expect(plan.map((entry) => entry.unit.id)).toEqual(["u1"]);
  });
});

describe("unités proposées", () => {
  const units = [
    unit("u1", "#1"),
    unit("u2", "#2"),
    unit("u3", "#3"),
    { ...unit("u4", "#4"), status: "maintenance" as const },
  ];
  const allocation = (
    itemUnitId: string,
    over: Partial<Parameters<typeof equipmentCandidates>[0]["allocations"][number]> = {},
  ) => ({
    id: `a-${itemUnitId}`,
    itemUnitId,
    eventId: "other",
    bookingId: null,
    cancelledAt: null,
    ...period,
    ...over,
  });
  const ids = (input: Partial<Parameters<typeof equipmentCandidates>[0]>) =>
    equipmentCandidates({ units, allocations: [], period, eventId: "ev", ...input }).map(
      (entry) => entry.unit.id,
    );

  it("exclut les unités prises, en maintenance, hors restriction de l'événement", () => {
    expect(ids({})).toEqual(["u1", "u2", "u3"]);
    expect(ids({ allocations: [allocation("u1")] })).toEqual(["u2", "u3"]);
    expect(ids({ restrictTo: ["u2", "u4"] })).toEqual(["u2"]);
    // Une réservation annulée ne retient rien.
    expect(ids({ allocations: [allocation("u1", { cancelledAt: new Date() })] })).toEqual([
      "u1",
      "u2",
      "u3",
    ]);
  });

  it("propose d'abord les unités déjà réservées à l'événement, jamais celles d'une réservation", () => {
    const result = equipmentCandidates({
      units,
      allocations: [
        allocation("u3", { eventId: "ev" }),
        allocation("u2", { eventId: "ev", bookingId: "b1" }),
      ],
      period,
      eventId: "ev",
    });
    expect(result.map((entry) => entry.unit.id)).toEqual(["u3", "u1"]);
    expect(result[0]?.allocationId).toBe("a-u3");
  });
});

describe("schémas", () => {
  it("le matériel exige un type de matériel et refuse deux besoins de même identifiant", () => {
    expect(equipmentModuleSchema.safeParse({ needs: [tour()] }).success).toBe(true);
    expect(equipmentModuleSchema.safeParse({ needs: [tour({ itemTypeId: "x" })] }).success).toBe(
      false,
    );
    expect(equipmentModuleSchema.safeParse({ needs: [tour(), tour()] }).success).toBe(false);
    expect(equipmentModuleSchema.safeParse({ needs: [tour({ perSeat: 0 })] }).success).toBe(false);
  });

  it("le lieu : mode connu, lien valide", () => {
    expect(
      locationModuleSchema.safeParse({ mode: "online", onlineUrl: "https://meet.example/abc" })
        .success,
    ).toBe(true);
    expect(
      locationModuleSchema.safeParse({ mode: "online", onlineUrl: "pas un lien" }).success,
    ).toBe(false);
    expect(locationModuleSchema.safeParse({ mode: "nulle part" }).success).toBe(false);
  });
});

describe("lieu", () => {
  const entered = { locationName: null, locationAddress: null, onlineUrl: null };
  it("à l'atelier : l'adresse de l'espace, ou celle du module, sans écraser celle de l'événement", () => {
    expect(eventPlace({ mode: "venue" }, entered, "12 rue des Potiers").locationAddress).toBe(
      "12 rue des Potiers",
    );
    expect(
      eventPlace({ mode: "venue", address: "Annexe" }, entered, "12 rue des Potiers")
        .locationAddress,
    ).toBe("Annexe");
    expect(
      eventPlace(
        { mode: "venue", address: "Annexe" },
        { ...entered, locationAddress: "Salle 3" },
        null,
      ).locationAddress,
    ).toBe("Salle 3");
  });

  it("en ligne : le lien du module ; chez le client : un nom de lieu et la question d'adresse", () => {
    expect(
      eventPlace({ mode: "online", onlineUrl: "https://meet.example/a" }, entered, null).onlineUrl,
    ).toBe("https://meet.example/a");
    expect(eventPlace({ mode: "client" }, entered, "12 rue").locationName).toBe(CLIENT_SITE_LABEL);
    const fields = withModuleFields([], { location: { mode: "client" } });
    expect(fields.map((field) => field.key)).toEqual([CLIENT_ADDRESS_FIELD_KEY]);
    expect(fields[0]).toMatchObject({ scope: "booking", required: true });
    expect(withModuleFields([], { location: { mode: "venue" } })).toEqual([]);
  });

  it("le lien de visio et le matériel ne quittent pas le serveur", () => {
    const view = publicModules({
      location: { mode: "online", onlineUrl: "https://meet.example/secret" },
      equipment: { needs: [tour()] },
      staff: { memberIds: [TYPE], showOnPublicPage: true },
    });
    expect(JSON.stringify(view)).not.toContain("secret");
    expect(view.equipment).toBeUndefined();
    expect(view.staff).toEqual({ showOnPublicPage: true });
  });
});

describe("intervenant", () => {
  it("liste vide : toute l'équipe ; sinon seulement les membres proposés", () => {
    expect(staffAllowed(undefined, "m1")).toBe(true);
    expect(staffAllowed({ memberIds: [] }, "m1")).toBe(true);
    expect(staffAllowed({ memberIds: ["m2"] }, "m1")).toBe(false);
    expect(staffAllowed({ memberIds: ["m1"] }, "m1")).toBe(true);
  });

  it("les modules s'enregistrent avec les autres", () => {
    expect(
      eventTypeModulesSchema.parse({
        equipment: { needs: [tour()] },
        location: { mode: "venue" },
        staff: {},
      }),
    ).toMatchObject({ staff: {}, location: { mode: "venue" } });
  });
});
