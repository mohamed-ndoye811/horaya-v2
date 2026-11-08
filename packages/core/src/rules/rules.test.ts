import { describe, expect, it } from "vitest";
import type { Event } from "../events/model";
import type { EventTypeField } from "../fields/model";
import type { Repositories } from "../shared/unit-of-work";
import {
  askedFields,
  compareAnswer,
  conditionHolds,
  formRules,
  isRuleDue,
  type RuleFacts,
  ruleIssues,
  ruleMatches,
  ruleWindow,
  submissionOutcome,
} from "./engine";
import { eventTypeRulesSchema, type Rule, type RuleCondition, ruleSchema } from "./model";
import type { NewRuleRun } from "./ports";
import {
  describeCondition,
  describeRule,
  ruleJournalLine,
  ruleMomentLabel,
  ruleSentence,
} from "./sentence";
import { recordRuleRuns } from "./use-cases";

const FIELDS: EventTypeField[] = [
  {
    key: "niveau",
    label: "Niveau",
    type: "choice",
    scope: "event",
    required: true,
    options: ["Débutant", "Confirmé"],
  },
  { key: "terre", label: "Terre utilisée", type: "short_text", scope: "event", required: false },
  { key: "deja", label: "Tu as déjà tourné ?", type: "boolean", scope: "booking", required: true },
  { key: "allergies", label: "Allergies", type: "long_text", scope: "booking", required: false },
  {
    key: "envies",
    label: "Envies",
    type: "multi_choice",
    scope: "booking",
    required: false,
    options: ["Bol", "Vase"],
  },
  { key: "arrivee", label: "Arrivée", type: "date", scope: "booking", required: false },
  { key: "reglement", label: "Règlement", type: "acceptance", scope: "booking", required: true },
  { key: "age", label: "Âge", type: "number", scope: "participant", required: true },
];

const EVENT = { fieldValues: { niveau: "Débutant" }, capacity: 10, seatsHeld: 7, equipmentLeft: 2 };

const facts = (overrides: Partial<RuleFacts> = {}): RuleFacts => ({
  event: EVENT,
  booking: {
    answers: { deja: false, allergies: "Noix, lactose", envies: ["Bol"], arrivee: "2026-10-12" },
    participants: [{ answers: { age: 34 } }, { answers: { age: 14 } }],
  },
  customer: { isNew: true, tags: ["Adhérent"], hasActivePass: false },
  ...overrides,
});

const field = (
  fieldKey: string,
  operator: Extract<RuleCondition, { kind: "field" }>["operator"],
  value?: string | number | boolean,
): RuleCondition => ({ kind: "field", fieldKey, operator, value });

const MINORS: Rule = {
  id: "mineurs",
  name: "Autorisation des mineurs",
  trigger: { kind: "booking_submitted" },
  conditions: [[field("age", "less_than", 16)]],
  actions: [
    {
      kind: "ask",
      field: {
        key: "accord_parent",
        label: "Je suis son représentant légal et j'autorise sa participation",
        type: "acceptance",
      },
    },
    { kind: "remind_document", label: "l'autorisation signée" },
  ],
};

const LAST_SEATS: Rule = {
  id: "dernieres-places",
  name: "Dernières places",
  trigger: { kind: "before_start", hours: 7 * 24 },
  conditions: [
    [
      field("niveau", "equals", "Débutant"),
      { kind: "seats", measure: "remaining", operator: "greater_than", value: 0 },
    ],
  ],
  actions: [{ kind: "notify_team", message: "Relance les anciens élèves" }],
};

describe("conditions sur un champ", () => {
  const holds = (condition: RuleCondition, base = facts()) =>
    conditionHolds(condition, FIELDS, base);

  it("égal, différent : choix, oui / non, texte sans casse, nombre", () => {
    expect(holds(field("niveau", "equals", "Débutant"))).toBe(true);
    expect(holds(field("niveau", "not_equals", "Débutant"))).toBe(false);
    expect(holds(field("deja", "equals", false))).toBe(true);
    expect(holds(field("deja", "equals", "true"))).toBe(false);
    expect(
      holds(
        field("terre", "equals", "grès"),
        facts({ event: { ...EVENT, fieldValues: { terre: " Grès " } } }),
      ),
    ).toBe(true);
    expect(holds(field("envies", "equals", "Bol"))).toBe(true);
  });

  it("une réponse absente n'est égale à rien, donc différente de tout", () => {
    expect(holds(field("terre", "equals", "Grès"))).toBe(false);
    expect(holds(field("terre", "not_equals", "Grès"))).toBe(true);
    expect(holds(field("terre", "contains", "Grès"))).toBe(false);
  });

  it("contient : texte (sans casse) ou choix multiple", () => {
    expect(holds(field("allergies", "contains", "noix"))).toBe(true);
    expect(holds(field("allergies", "contains", "gluten"))).toBe(false);
    expect(holds(field("envies", "contains", "vase"))).toBe(false);
    expect(holds(field("envies", "contains", "bol"))).toBe(true);
  });

  it("inférieur, supérieur : nombres et dates, strictement", () => {
    expect(compareAnswer(FIELDS[7] as EventTypeField, 15, "less_than", 16)).toBe(true);
    expect(compareAnswer(FIELDS[7] as EventTypeField, 16, "less_than", 16)).toBe(false);
    expect(compareAnswer(FIELDS[7] as EventTypeField, 17, "greater_than", "16")).toBe(true);
    expect(compareAnswer(FIELDS[7] as EventTypeField, 17, "greater_than", "abc")).toBe(false);
    expect(holds(field("arrivee", "less_than", "2026-10-13"))).toBe(true);
    expect(holds(field("arrivee", "greater_than", "2026-10-12"))).toBe(false);
    expect(holds(field("arrivee", "greater_than", "2026-10-01"))).toBe(true);
    // Un texte ne se compare pas.
    expect(holds(field("allergies", "less_than", "z"))).toBe(false);
  });

  it("est rempli : vide, liste vide et absence comptent comme non remplis", () => {
    expect(holds(field("allergies", "filled"))).toBe(true);
    expect(holds(field("terre", "filled"))).toBe(false);
    const empty = facts({ booking: { answers: { envies: [], allergies: "" }, participants: [] } });
    expect(holds(field("envies", "filled"), empty)).toBe(false);
    expect(holds(field("allergies", "filled"), empty)).toBe(false);
  });

  it("portée participant : un seul participant suffit ; aucun participant, rien", () => {
    expect(holds(field("age", "less_than", 16))).toBe(true);
    expect(holds(field("age", "less_than", 12))).toBe(false);
    expect(
      holds(field("age", "less_than", 16), facts({ booking: { answers: {}, participants: [] } })),
    ).toBe(false);
  });

  it("champ inconnu : faux ; fait absent : inconnu", () => {
    expect(holds(field("disparu", "filled"))).toBe(false);
    expect(
      holds(field("niveau", "equals", "Débutant"), { booking: facts().booking }),
    ).toBeUndefined();
    expect(holds(field("deja", "equals", true), { event: EVENT })).toBeUndefined();
    expect(holds(field("age", "less_than", 16), { event: EVENT })).toBeUndefined();
  });
});

describe("conditions sur les places, le client, le matériel", () => {
  const holds = (condition: RuleCondition, base = facts()) =>
    conditionHolds(condition, FIELDS, base);

  it("places prises et restantes ; illimitées : il en reste toujours", () => {
    expect(holds({ kind: "seats", measure: "booked", operator: "less_than", value: 8 })).toBe(true);
    expect(holds({ kind: "seats", measure: "booked", operator: "equals", value: 7 })).toBe(true);
    expect(holds({ kind: "seats", measure: "remaining", operator: "equals", value: 3 })).toBe(true);
    expect(holds({ kind: "seats", measure: "remaining", operator: "greater_than", value: 3 })).toBe(
      false,
    );
    const unlimited = facts({ event: { ...EVENT, capacity: null } });
    expect(
      holds(
        { kind: "seats", measure: "remaining", operator: "greater_than", value: 1000 },
        unlimited,
      ),
    ).toBe(true);
    const over = facts({ event: { ...EVENT, seatsHeld: 12 } });
    expect(holds({ kind: "seats", measure: "remaining", operator: "equals", value: 0 }, over)).toBe(
      true,
    );
  });

  it("client nouveau, étiquette (sans casse), carte active", () => {
    expect(holds({ kind: "customer", is: "new" })).toBe(true);
    expect(holds({ kind: "customer", is: "tagged", tag: "adhérent" })).toBe(true);
    expect(holds({ kind: "customer", is: "tagged", tag: "VIP" })).toBe(false);
    expect(holds({ kind: "customer", is: "pass_holder" })).toBe(false);
    expect(holds({ kind: "customer", is: "new" }, { event: EVENT })).toBeUndefined();
  });

  it("matériel restant", () => {
    expect(holds({ kind: "equipment", operator: "less_than", value: 3 })).toBe(true);
    expect(holds({ kind: "equipment", operator: "greater_than", value: 2 })).toBe(false);
    expect(
      holds({ kind: "equipment", operator: "equals", value: 2 }, { booking: facts().booking }),
    ).toBeUndefined();
  });
});

describe("Et / Ou", () => {
  const yes = field("niveau", "equals", "Débutant");
  const no = field("niveau", "equals", "Confirmé");
  const unknown: RuleCondition = { kind: "customer", is: "new" };
  const matches = (conditions: RuleCondition[][], base = facts(), unknownIs = false) =>
    ruleMatches({ conditions }, FIELDS, base, unknownIs);

  it("sans condition : toujours", () => {
    expect(matches([])).toBe(true);
  });
  it("Et : toutes les conditions du groupe", () => {
    expect(matches([[yes, yes]])).toBe(true);
    expect(matches([[yes, no]])).toBe(false);
  });
  it("Ou : un groupe suffit", () => {
    expect(matches([[no], [yes]])).toBe(true);
    expect(matches([[no], [yes, no]])).toBe(false);
  });
  it("un fait inconnu vaut ce que choisit l'appelant", () => {
    expect(matches([[yes, unknown]], { event: EVENT })).toBe(false);
    expect(matches([[yes, unknown]], { event: EVENT }, true)).toBe(true);
    expect(matches([[no, unknown]], { event: EVENT }, true)).toBe(false);
  });
});

describe("inscription envoyée : chaque action", () => {
  const rule = (actions: Rule["actions"], conditions: Rule["conditions"] = []): Rule => ({
    id: `r-${actions.map((action) => action.kind).join("-")}`,
    name: "Règle",
    trigger: { kind: "booking_submitted" },
    conditions,
    actions,
  });

  it("demander une acceptation et rappeler un document : les mineurs seulement", () => {
    const outcome = submissionOutcome([MINORS], FIELDS, facts());
    expect(outcome.matched.map((entry) => entry.id)).toEqual(["mineurs"]);
    expect(outcome.asked).toEqual([
      {
        key: "accord_parent",
        label: "Je suis son représentant légal et j'autorise sa participation",
        type: "acceptance",
        scope: "booking",
        required: true,
      },
    ]);
    const adults = facts({ booking: { answers: {}, participants: [{ answers: { age: 40 } }] } });
    expect(submissionOutcome([MINORS], FIELDS, adults)).toEqual({
      matched: [],
      asked: [],
      refusal: null,
      approval: false,
    });
  });

  it("refuser avec un message : le premier refus l'emporte", () => {
    const outcome = submissionOutcome(
      [
        rule(
          [{ kind: "refuse", message: "Complet pour les nouveaux" }],
          [[{ kind: "customer", is: "new" }]],
        ),
        rule([{ kind: "refuse", message: "Autre" }]),
      ],
      FIELDS,
      facts(),
    );
    expect(outcome.refusal).toBe("Complet pour les nouveaux");
  });

  it("mettre en attente de validation, prévenir l'équipe, envoyer un message", () => {
    const outcome = submissionOutcome(
      [
        rule([{ kind: "require_approval" }, { kind: "notify_team" }]),
        rule([{ kind: "message", subject: "Bienvenue", body: "À samedi" }]),
      ],
      FIELDS,
      facts(),
    );
    expect(outcome.approval).toBe(true);
    expect(outcome.refusal).toBeNull();
    expect(outcome.matched).toHaveLength(2);
  });

  it("ne regarde que les règles du moment « inscription envoyée »", () => {
    expect(submissionOutcome([LAST_SEATS], FIELDS, facts()).matched).toEqual([]);
  });

  it("askedFields : une question de règle devient un champ « une fois par inscription », requis", () => {
    expect(
      askedFields([MINORS]).map(({ key, scope, required }) => ({ key, scope, required })),
    ).toEqual([{ key: "accord_parent", scope: "booking", required: true }]);
  });
});

describe("règles envoyées au formulaire", () => {
  const event = EVENT;
  const ask = MINORS.actions[0] as Rule["actions"][number];

  it("ne garde que les questions des règles d'inscription", () => {
    const rules = formRules([MINORS, LAST_SEATS], FIELDS, event);
    expect(rules).toHaveLength(1);
    expect(rules[0]?.actions).toEqual([ask]);
    expect(rules[0]?.conditions).toEqual(MINORS.conditions);
  });

  it("tranche l'événement côté serveur, tient le client pour vrai", () => {
    const rule: Rule = {
      ...MINORS,
      conditions: [
        [field("niveau", "equals", "Confirmé"), field("deja", "equals", true)],
        [
          field("niveau", "equals", "Débutant"),
          { kind: "customer", is: "tagged", tag: "VIP" },
          field("deja", "equals", false),
        ],
      ],
    };
    expect(formRules([rule], FIELDS, event)[0]?.conditions).toEqual([
      [field("deja", "equals", false)],
    ]);
    const always: Rule = { ...MINORS, conditions: [[field("niveau", "equals", "Débutant")]] };
    expect(formRules([always], FIELDS, event)[0]?.conditions).toEqual([]);
    const never: Rule = { ...MINORS, conditions: [[field("niveau", "equals", "Confirmé")]] };
    expect(formRules([never], FIELDS, event)).toEqual([]);
  });
});

describe("moments planifiés", () => {
  const event = {
    startsAt: new Date("2026-10-20T16:00:00Z"),
    endsAt: new Date("2026-10-20T18:00:00Z"),
  };

  it("J-7 : de 7 jours avant jusqu'au début", () => {
    expect(ruleWindow(LAST_SEATS.trigger, event)).toEqual({
      from: new Date("2026-10-13T16:00:00Z"),
      until: event.startsAt,
    });
    expect(isRuleDue(LAST_SEATS.trigger, event, new Date("2026-10-13T15:59:00Z"))).toBe(false);
    expect(isRuleDue(LAST_SEATS.trigger, event, new Date("2026-10-13T16:00:00Z"))).toBe(true);
    expect(isRuleDue(LAST_SEATS.trigger, event, event.startsAt)).toBe(false);
  });

  it("après la séance : pendant deux jours", () => {
    const after = { kind: "after_end" } as const;
    expect(isRuleDue(after, event, new Date("2026-10-20T18:00:00Z"))).toBe(true);
    expect(isRuleDue(after, event, new Date("2026-10-22T17:59:00Z"))).toBe(true);
    expect(isRuleDue(after, event, new Date("2026-10-22T18:00:00Z"))).toBe(false);
  });

  it("les autres déclencheurs ne sont pas planifiés", () => {
    expect(ruleWindow({ kind: "seat_released" }, event)).toBeNull();
    expect(isRuleDue({ kind: "booking_submitted" }, event, event.startsAt)).toBe(false);
  });
});

describe("schéma et cohérence", () => {
  it("accepte les deux règles de la démo", () => {
    expect(eventTypeRulesSchema.safeParse([MINORS, LAST_SEATS]).success).toBe(true);
    expect(ruleIssues([MINORS, LAST_SEATS], FIELDS)).toEqual([]);
  });

  it("refuse une action qui ne va pas avec le moment, une valeur manquante, une étiquette vide", () => {
    const issues = (rule: unknown) =>
      ruleSchema.safeParse(rule).error?.issues.map((issue) => issue.message) ?? [];
    expect(issues({ ...LAST_SEATS, actions: [{ kind: "refuse", message: "Non" }] })).toEqual([
      "Cette action ne va pas avec ce moment",
    ]);
    expect(issues({ ...MINORS, conditions: [[field("age", "less_than")]] })).toEqual([
      "Indique la valeur à comparer",
    ]);
    expect(issues({ ...MINORS, conditions: [[{ kind: "customer", is: "tagged" }]] })).toEqual([
      "Indique l'étiquette",
    ]);
    expect(issues({ ...LAST_SEATS, conditions: [[{ kind: "customer", is: "new" }]] })).toEqual([
      "Le client n'est connu qu'au moment d'une inscription",
    ]);
    expect(issues({ ...MINORS, actions: [] })).toEqual(["Ajoute au moins une action"]);
    expect(issues({ ...MINORS, actions: [MINORS.actions[0], MINORS.actions[0]] })).toEqual([
      "Deux questions ont la même clé",
    ]);
  });

  it("deux règles ne partagent pas un identifiant", () => {
    expect(eventTypeRulesSchema.safeParse([MINORS, MINORS]).success).toBe(false);
  });

  it("vérifie les champs : existant, comparable, réponse connue au bon moment, clé libre", () => {
    const messages = (rule: Rule) => ruleIssues([rule], FIELDS).map((issue) => issue.message);
    expect(messages({ ...MINORS, conditions: [[field("disparu", "filled")]] })).toEqual([
      "« Autorisation des mineurs » : le champ « disparu » n'existe plus",
    ]);
    expect(messages({ ...MINORS, conditions: [[field("allergies", "less_than", 3)]] })).toEqual([
      "« Autorisation des mineurs » : « Allergies » ne se compare pas (nombre ou date seulement)",
    ]);
    expect(messages({ ...MINORS, conditions: [[field("deja", "contains", "x")]] })).toHaveLength(1);
    expect(messages({ ...MINORS, conditions: [[field("niveau", "equals", "Expert")]] })).toEqual([
      "« Autorisation des mineurs » : « Expert » n'est pas un choix de « Niveau »",
    ]);
    expect(
      messages({ ...MINORS, conditions: [[field("reglement", "equals", true)]] }),
    ).toHaveLength(1);
    expect(messages({ ...LAST_SEATS, conditions: [[field("deja", "equals", true)]] })).toEqual([
      "« Dernières places » : les réponses d'inscription ne sont connues qu'au moment d'une inscription",
    ]);
    const clash: Rule = {
      ...MINORS,
      actions: [{ kind: "ask", field: { key: "deja", label: "Encore", type: "boolean" } }],
    };
    expect(messages(clash)).toEqual([
      "« Autorisation des mineurs » : la clé « deja » est déjà une question",
    ]);
    expect(ruleIssues([MINORS, { ...MINORS, id: "copie" }], FIELDS)).toHaveLength(1);
  });
});

describe("phrase en clair", () => {
  it("règle des mineurs", () => {
    expect(ruleSentence(MINORS, FIELDS)).toBe(
      "À chaque inscription, si un participant a moins de 16 ans, demander d'accepter « Je suis son représentant légal et j'autorise sa participation » et rappeler d'apporter l'autorisation signée.",
    );
    expect(describeRule(MINORS, FIELDS).condition).toBe("un participant a moins de 16 ans");
  });

  it("J-7 : « et qu'il reste des places »", () => {
    expect(ruleSentence(LAST_SEATS, FIELDS)).toBe(
      "À J-7, si « Niveau » est Débutant et qu'il reste des places, prévenir l'équipe.",
    );
  });

  it("Ou, sans condition, moments et messages", () => {
    const rule: Rule = {
      id: "x",
      name: "X",
      trigger: { kind: "booking_cancelled" },
      conditions: [[{ kind: "customer", is: "new" }], [{ kind: "customer", is: "pass_holder" }]],
      actions: [{ kind: "message", subject: "Dommage", body: "…" }, { kind: "notify_team" }],
    };
    expect(ruleSentence(rule, FIELDS)).toBe(
      "Quand une inscription est annulée, si le client est nouveau, ou si le client a une carte de séances active, envoyer « Dommage » au client et prévenir l'équipe.",
    );
    expect(
      ruleSentence(
        {
          trigger: { kind: "before_start", hours: 3 },
          conditions: [],
          actions: [
            { kind: "message", subject: "Ça commence", body: "…" },
            { kind: "cancel_event" },
          ],
        },
        FIELDS,
      ),
    ).toBe("3 h avant la séance, envoyer « Ça commence » aux inscrits et annuler la séance.");
    expect(
      ruleSentence(
        {
          trigger: { kind: "booking_submitted" },
          conditions: [[{ kind: "customer", is: "tagged", tag: "VIP" }]],
          actions: [
            { kind: "require_approval" },
            { kind: "refuse", message: "Réservé" },
            {
              kind: "remind_document",
              label: "un certificat",
              file: { name: "Modèle", url: "/x" },
            },
          ],
        },
        FIELDS,
      ),
    ).toBe(
      "À chaque inscription, si le client porte l'étiquette « VIP », mettre l'inscription en attente de validation, refuser l'inscription (« Réservé ») et rappeler d'apporter un certificat, avec le modèle en PDF.",
    );
  });

  it("chaque condition", () => {
    const say = (condition: RuleCondition) => describeCondition(condition, FIELDS);
    expect(say(field("niveau", "not_equals", "Débutant"))).toBe("« Niveau » n'est pas Débutant");
    expect(say(field("allergies", "contains", "noix"))).toBe("« Allergies » contient noix");
    expect(say(field("deja", "equals", true))).toBe("« Tu as déjà tourné ? » est oui");
    expect(say(field("arrivee", "less_than", "2026-10-12"))).toBe(
      "« Arrivée » est avant le 12 octobre 2026",
    );
    expect(say(field("arrivee", "greater_than", "2026-10-12"))).toBe(
      "« Arrivée » est après le 12 octobre 2026",
    );
    expect(say(field("age", "greater_than", 60))).toBe("un participant a plus de 60 ans");
    expect(say(field("age", "equals", 8))).toBe("pour un participant, « Âge » est 8");
    expect(say(field("terre", "filled"))).toBe("« Terre utilisée » est rempli");
    expect(say(field("reglement", "filled"))).toBe("« Règlement » est cochée");
    expect(say({ kind: "seats", measure: "remaining", operator: "equals", value: 0 })).toBe(
      "c'est complet",
    );
    expect(say({ kind: "seats", measure: "remaining", operator: "less_than", value: 2 })).toBe(
      "il reste moins de 2 places",
    );
    expect(say({ kind: "seats", measure: "booked", operator: "less_than", value: 4 })).toBe(
      "il y a moins de 4 inscrits",
    );
    expect(say({ kind: "seats", measure: "booked", operator: "greater_than", value: 1 })).toBe(
      "il y a plus de 1 inscrit",
    );
    expect(say({ kind: "equipment", operator: "less_than", value: 3 })).toBe(
      "il reste moins de 3 exemplaires de matériel",
    );
  });

  it("moment en étiquette et ligne du journal", () => {
    expect(ruleMomentLabel(MINORS.trigger)).toBe("Inscription");
    expect(ruleMomentLabel(LAST_SEATS.trigger)).toBe("J-7");
    expect(ruleMomentLabel({ kind: "before_start", hours: 2 })).toBe("2 h avant");
    expect(ruleJournalLine(MINORS.name, MINORS.actions)).toBe(
      "Règle « Autorisation des mineurs » : accord demandé et rappel d'apporter l'autorisation signée",
    );
  });
});

describe("trace : jamais deux fois la même règle", () => {
  it("une trace déjà prise n'écrit rien au journal", async () => {
    const claimed = new Set<string>();
    const journal: unknown[] = [];
    const repositories = {
      rules: {
        async claim(run: NewRuleRun) {
          const key = `${run.eventId}/${run.ruleId}/${run.bookingId}`;
          if (claimed.has(key)) return false;
          claimed.add(key);
          return true;
        },
      },
      activity: { record: async (entry: unknown) => void journal.push(entry) },
    } as unknown as Repositories;
    const event = { id: "ev", organizationId: "org" } as Event;
    const actor = { type: "customer", organizationId: "org" } as const;
    const input = {
      event,
      bookingId: "bk",
      trigger: "booking_submitted" as const,
      runs: [{ rule: MINORS, actions: MINORS.actions }],
    };
    await recordRuleRuns(repositories, actor, input);
    await recordRuleRuns(repositories, actor, input);
    await recordRuleRuns(repositories, actor, {
      ...input,
      runs: [{ rule: LAST_SEATS, actions: [] }],
    });
    expect(journal).toEqual([
      {
        organizationId: "org",
        entityType: "booking",
        entityId: "bk",
        action: "booking.rule_applied",
        actorType: "customer",
        actorId: null,
        data: {
          ruleId: "mineurs",
          rule: "Autorisation des mineurs",
          trigger: "booking_submitted",
          actions: MINORS.actions,
        },
      },
    ]);
  });
});
