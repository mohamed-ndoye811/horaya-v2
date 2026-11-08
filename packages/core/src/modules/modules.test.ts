import { describe, expect, it } from "vitest";
import { EVENT_TYPE_TEMPLATES } from "../events/templates";
import type { FieldValues } from "../fields/model";
import { eventTypeFieldsSchema } from "../fields/schemas";
import { ValidationError } from "../shared/errors";
import {
  eventTypeModulesSchema,
  MODULE_CATALOG,
  MODULE_GROUPS,
  MODULE_KEYS,
  MODULE_SCHEMAS,
} from "./registry";
import {
  AGE_FIELD,
  ageIssues,
  bookingWindow,
  cancellationPolicyOf,
  closingLabel,
  hasAccessTag,
  legacyModules,
  minimumDecisionAt,
  minimumState,
  moduleSummary,
  publicModules,
  windowState,
  withModuleFields,
} from "./rules";

const startsAt = new Date("2026-12-10T18:00:00Z");
const hoursBefore = (hours: number) => new Date(startsAt.getTime() - hours * 3_600_000);
const structure = { freeCancellationHours: 72, lateCancellationRefundPercent: 50 };
const context = { noun: "inscription", structure };

describe("registre des modules", () => {
  it("chaque module disponible a sa place dans le catalogue, avec un groupe connu", () => {
    const groups = new Set(MODULE_GROUPS.map((group) => group.id));
    for (const key of MODULE_KEYS) {
      const entry = MODULE_CATALOG.find((module) => module.key === key);
      expect(entry, key).toBeDefined();
      expect(entry?.soon).toBeUndefined();
      expect(groups.has(entry?.group ?? "reserve")).toBe(true);
    }
  });

  it("les réglages par défaut du catalogue passent le schéma de leur module", () => {
    for (const entry of MODULE_CATALOG.filter((module) => !module.soon)) {
      const schema = MODULE_SCHEMAS[entry.key as keyof typeof MODULE_SCHEMAS];
      expect(schema.safeParse(entry.defaults).success, entry.key).toBe(true);
    }
  });

  it("les modules « Bientôt » n'ont pas de schéma et sont ignorés à l'enregistrement", () => {
    const soon = MODULE_CATALOG.filter((module) => module.soon).map((module) => module.key);
    expect(soon).toEqual([
      "sessions",
      "slots",
      "duration",
      "pricing",
      "deposit",
      "payment_methods",
      "equipment",
      "location",
      "staff",
    ]);
    expect(eventTypeModulesSchema.parse({ pricing: { tiers: [] }, waitlist: {} })).toEqual({
      waitlist: {},
    });
  });

  it("les modèles déclarent des modules valides", () => {
    for (const template of EVENT_TYPE_TEMPLATES) {
      expect(eventTypeModulesSchema.safeParse(template.modules).success, template.id).toBe(true);
    }
    const collectif = EVENT_TYPE_TEMPLATES.find((template) => template.id === "cours-collectif");
    expect(collectif?.modules.places?.minimum).toEqual({ seats: 4, daysBefore: 2 });
  });
});

describe("schémas des modules", () => {
  const ok = (key: keyof typeof MODULE_SCHEMAS, value: unknown) =>
    MODULE_SCHEMAS[key].safeParse(value).success;

  it("places : capacité, maximum par inscription, seuil au plus tard à J-1", () => {
    expect(
      ok("places", { capacity: 12, maxPerBooking: 2, minimum: { seats: 4, daysBefore: 2 } }),
    ).toBe(true);
    expect(ok("places", { capacity: 0 })).toBe(false);
    expect(ok("places", { minimum: { seats: 4, daysBefore: 0 } })).toBe(false);
  });

  it("liste d'attente et validation : aucun réglage", () => {
    expect(ok("waitlist", {})).toBe(true);
    expect(ok("approval", {})).toBe(true);
  });

  it("ouverture : J-N ou date fixe, pas les deux", () => {
    expect(ok("opening", { opensDaysBefore: 30, closesHoursBefore: 24 })).toBe(true);
    expect(ok("opening", { opensAt: "2026-09-01T08:00:00.000Z" })).toBe(true);
    expect(ok("opening", { opensAt: "1er septembre" })).toBe(false);
    expect(ok("opening", { opensDaysBefore: 30, opensAt: "2026-09-01T08:00:00.000Z" })).toBe(false);
  });

  it("annulation : délai en heures, remboursement entre 0 et 100 %", () => {
    expect(ok("cancellation", { freeHours: 48, lateRefundPercent: 0 })).toBe(true);
    expect(ok("cancellation", {})).toBe(true);
    expect(ok("cancellation", { lateRefundPercent: 120 })).toBe(false);
  });

  it("conditions d'accès : âge minimum sous l'âge maximum, étiquettes", () => {
    expect(ok("access", { minAge: 12, tags: ["adhérent"], inviteOnly: true })).toBe(true);
    expect(ok("access", { minAge: 16, maxAge: 12 })).toBe(false);
    expect(ok("access", { tags: [""] })).toBe(false);
  });

  it("inscription à la série : prix optionnel, positif", () => {
    expect(ok("series", { priceCents: 36_000, dropInAllowed: false })).toBe(true);
    expect(ok("series", { priceCents: -1 })).toBe(false);
  });

  it("messages : rappel la veille à une heure ou X heures avant", () => {
    expect(ok("messages", { bring: "Un tablier", reminder: { kind: "eve", hour: 18 } })).toBe(true);
    expect(ok("messages", { reminder: { kind: "before", hours: 2 } })).toBe(true);
    expect(ok("messages", { reminder: { kind: "eve", hour: 24 } })).toBe(false);
  });

  it("documents : seulement des PDF rangés par l'app, 5 au plus", () => {
    const file = {
      name: "Règlement",
      url: "/fichiers/org-1/documents/2f6f1b8e-3c55-4f0e-9f57-6b1a0f0c1d2e.pdf",
      size: 1000,
    };
    expect(ok("documents", { files: [file] })).toBe(true);
    expect(ok("documents", { files: [{ ...file, url: "https://exemple.fr/a.pdf" }] })).toBe(false);
    expect(ok("documents", { files: Array(6).fill(file) })).toBe(false);
  });
});

describe("ouverture des inscriptions", () => {
  it("sans module : ouvert dès la publication, jusqu'au début", () => {
    const window = bookingWindow(startsAt, undefined);
    expect(window).toEqual({ opensAt: null, closesAt: startsAt });
    expect(windowState(window, hoursBefore(1000))).toBe("open");
    expect(windowState(window, startsAt)).toBe("closed");
  });

  it("J-30, fermeture la veille", () => {
    const window = bookingWindow(startsAt, { opensDaysBefore: 30, closesHoursBefore: 24 });
    expect(window.opensAt).toEqual(hoursBefore(30 * 24));
    expect(windowState(window, hoursBefore(31 * 24))).toBe("upcoming");
    expect(windowState(window, hoursBefore(30 * 24))).toBe("open");
    expect(windowState(window, hoursBefore(25))).toBe("open");
    expect(windowState(window, hoursBefore(24))).toBe("closed");
  });

  it("date fixe", () => {
    const window = bookingWindow(startsAt, { opensAt: "2026-11-01T08:00:00.000Z" });
    expect(windowState(window, new Date("2026-11-01T07:59:00Z"))).toBe("upcoming");
    expect(windowState(window, new Date("2026-11-01T08:00:00Z"))).toBe("open");
  });

  it("libellés de fermeture", () => {
    expect(closingLabel(undefined)).toBe("le début");
    expect(closingLabel(24)).toBe("la veille");
    expect(closingLabel(48)).toBe("J-2");
    expect(closingLabel(3)).toBe("3 h avant");
  });
});

describe("règle d'annulation par type", () => {
  it("module absent : la règle de la structure", () => {
    expect(cancellationPolicyOf({}, structure)).toEqual(structure);
  });

  it("module complet : la règle du type", () => {
    expect(
      cancellationPolicyOf({ cancellation: { freeHours: 48, lateRefundPercent: 0 } }, structure),
    ).toEqual({ freeCancellationHours: 48, lateCancellationRefundPercent: 0 });
  });

  it("réglage absent : la valeur de la structure", () => {
    expect(cancellationPolicyOf({ cancellation: { freeHours: 0 } }, structure)).toEqual({
      freeCancellationHours: 0,
      lateCancellationRefundPercent: 50,
    });
  });
});

describe("seuil de maintien", () => {
  const places = { capacity: 12, minimum: { seats: 4, daysBefore: 2 } };

  it("décision à J-2", () => {
    expect(minimumDecisionAt(startsAt, places)).toEqual(hoursBefore(48));
    expect(minimumDecisionAt(startsAt, { capacity: 12 })).toBeNull();
  });

  it("attente, risque la veille de J-2, annulation à J-2", () => {
    expect(minimumState(startsAt, places, 2, hoursBefore(80))).toBe("waiting");
    expect(minimumState(startsAt, places, 2, hoursBefore(72))).toBe("risk");
    expect(minimumState(startsAt, places, 2, hoursBefore(48))).toBe("cancel");
    expect(minimumState(startsAt, places, 2, hoursBefore(1))).toBe("cancel");
  });

  it("seuil atteint, pas de seuil ou événement commencé : rien à faire", () => {
    expect(minimumState(startsAt, places, 4, hoursBefore(48))).toBe("none");
    expect(minimumState(startsAt, { capacity: 12 }, 0, hoursBefore(48))).toBe("none");
    expect(minimumState(startsAt, places, 0, startsAt)).toBe("none");
  });
});

describe("conditions d'accès", () => {
  it("une condition d'âge ajoute la question « Âge » par participant", () => {
    const fields = withModuleFields([], { access: { minAge: 12 } });
    expect(fields).toEqual([AGE_FIELD]);
    expect(eventTypeFieldsSchema.safeParse(fields).success).toBe(true);
    expect(withModuleFields([], { access: { tags: ["adhérent"] } })).toEqual([]);
  });

  it("une question « age » existante devient obligatoire, sans condition", () => {
    const fields = withModuleFields(
      [
        {
          key: "age",
          label: "Âge de l'enfant",
          type: "number",
          scope: "participant",
          required: false,
          condition: { fieldKey: "x", equals: true },
        },
      ],
      { access: { maxAge: 12 } },
    );
    expect(fields).toEqual([
      {
        key: "age",
        label: "Âge de l'enfant",
        type: "number",
        scope: "participant",
        required: true,
      },
    ]);
  });

  it("une question « age » d'un autre type est refusée", () => {
    expect(() =>
      withModuleFields(
        [{ key: "age", label: "Âge", type: "short_text", scope: "booking", required: false }],
        { access: { minAge: 12 } },
      ),
    ).toThrow(ValidationError);
  });

  it("l'âge de chaque participant est contrôlé", () => {
    const participants: Array<{ answers: FieldValues }> = [
      { answers: { age: 14 } },
      { answers: { age: 9 } },
      { answers: {} },
    ];
    expect(ageIssues({ minAge: 12 }, participants)).toEqual([
      { path: "participants.1.answers.age", message: "Réservé : 12 ans minimum" },
    ]);
    expect(ageIssues({ minAge: 8, maxAge: 12 }, participants)).toEqual([
      { path: "participants.0.answers.age", message: "Réservé : 8 à 12 ans" },
    ]);
    expect(ageIssues(undefined, participants)).toEqual([]);
  });

  it("étiquettes : l'une d'elles suffit, sans tenir compte de la casse", () => {
    expect(hasAccessTag({ tags: ["Adhérent"] }, ["vip", "adhérent"])).toBe(true);
    expect(hasAccessTag({ tags: ["Adhérent"] }, ["vip"])).toBe(false);
    expect(hasAccessTag({ minAge: 12 }, [])).toBe(true);
  });
});

describe("reprise des anciens réglages", () => {
  it("chaque ancien réglage devient son module", () => {
    expect(
      legacyModules({
        defaultCapacity: 12,
        requiresApproval: true,
        bookingRules: { waitlistEnabled: true, minAdvanceHours: 24, maxSeatsPerBooking: 2 },
      }),
    ).toEqual({
      places: { capacity: 12, maxPerBooking: 2 },
      waitlist: {},
      approval: {},
      opening: { closesHoursBefore: 24 },
    });
  });

  it("rien de réglé : aucun module", () => {
    expect(
      legacyModules({
        defaultCapacity: null,
        requiresApproval: false,
        bookingRules: { waitlistEnabled: false, minAdvanceHours: 0 },
      }),
    ).toEqual({});
  });
});

describe("résumés et page publique", () => {
  it("résumé des places comme sur la maquette", () => {
    expect(
      moduleSummary(
        "places",
        { places: { capacity: 12, maxPerBooking: 2, minimum: { seats: 4, daysBefore: 2 } } },
        context,
      ),
    ).toBe(
      "12 par séance · 2 au plus par inscription · maintenu à partir de 4, sinon annulé à J-2",
    );
  });

  it("résumés de l'annulation, de l'ouverture, des messages et des documents", () => {
    expect(
      moduleSummary(
        "cancellation",
        { cancellation: { freeHours: 48, lateRefundPercent: 0 } },
        context,
      ),
    ).toBe("Gratuite jusqu'à 48 h avant · ensuite la séance est due · règle propre à ce type");
    expect(
      moduleSummary(
        "opening",
        { opening: { opensDaysBefore: 30, closesHoursBefore: 24 } },
        context,
      ),
    ).toBe("Ouvre à J-30 · ferme la veille");
    expect(
      moduleSummary(
        "messages",
        {
          messages: { bring: "une tenue qui ne craint rien", reminder: { kind: "eve", hour: 18 } },
        },
        context,
      ),
    ).toBe(
      "« À apporter : une tenue qui ne craint rien » dans la confirmation · rappel la veille à 18 h",
    );
    expect(moduleSummary("documents", { documents: { files: [] } }, context)).toBe(
      "Aucun document pour l'instant",
    );
    expect(moduleSummary("series", { series: { priceCents: 36_000 } }, context)).toBe(
      "Prix de la série 360 € · séance à l'unité encore possible · rattrapages",
    );
  });

  it("la page publique ne voit ni les documents ni les messages, sauf « À apporter »", () => {
    expect(
      publicModules({
        waitlist: {},
        documents: { files: [] },
        messages: { bring: "Un tablier", after: "Merci !" },
      }),
    ).toEqual({ waitlist: {}, messages: { bring: "Un tablier" } });
  });
});
