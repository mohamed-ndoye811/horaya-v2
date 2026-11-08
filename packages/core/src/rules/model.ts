import { z } from "zod";
import type { EventTypeField } from "../fields/model";
import { fieldKeySchema, fieldShape } from "../fields/schemas";
import { DOCUMENT_URL } from "../modules/registry";

/**
 * Règles « si… alors… » d'un type d'événement (lot 36) : un déclencheur, des conditions
 * (groupes « Et » reliés par « Ou »), des actions. L'événement en garde une copie à sa création,
 * comme les champs et les modules. Le moteur (engine.ts) est pur : il ne fait qu'évaluer.
 */

export const RULE_TRIGGERS = [
  "booking_submitted",
  "before_start",
  "after_end",
  "seat_released",
  "booking_cancelled",
] as const;
export type RuleTriggerKind = (typeof RULE_TRIGGERS)[number];

/** Déclencheurs liés à une inscription précise : ses réponses et son client sont connus. */
export const BOOKING_TRIGGERS: ReadonlySet<RuleTriggerKind> = new Set([
  "booking_submitted",
  "seat_released",
  "booking_cancelled",
]);

/** Déclencheurs passés par la tâche planifiée (un passage par heure). */
export const TIMED_TRIGGERS: ReadonlySet<RuleTriggerKind> = new Set(["before_start", "after_end"]);

export const ruleTriggerSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("booking_submitted") }),
  /** X heures avant le début (un multiple de 24 se lit « J-x »). */
  z.object({
    kind: z.literal("before_start"),
    hours: z
      .int({ error: "Délai invalide" })
      .min(1, "Au moins 1 h avant")
      .max(24 * 90),
  }),
  z.object({ kind: z.literal("after_end") }),
  z.object({ kind: z.literal("seat_released") }),
  z.object({ kind: z.literal("booking_cancelled") }),
]);
export type RuleTrigger = z.output<typeof ruleTriggerSchema>;

export const FIELD_OPERATORS = [
  "equals",
  "not_equals",
  "contains",
  "less_than",
  "greater_than",
  "filled",
] as const;
export type FieldOperator = (typeof FIELD_OPERATORS)[number];

export const COUNT_OPERATORS = ["less_than", "greater_than", "equals"] as const;
export type CountOperator = (typeof COUNT_OPERATORS)[number];

const count = z.int({ error: "Nombre invalide" }).min(0).max(100_000);

export const ruleConditionSchema = z.discriminatedUnion("kind", [
  /** Un champ du type : description de l'événement, réponse d'inscription ou d'un participant. */
  z.object({
    kind: z.literal("field"),
    fieldKey: fieldKeySchema,
    operator: z.enum(FIELD_OPERATORS),
    value: z.union([z.string().trim().max(200), z.number(), z.boolean()]).optional(),
  }),
  /** Places prises (en attente et confirmées) ou places restantes. */
  z.object({
    kind: z.literal("seats"),
    measure: z.enum(["booked", "remaining"]),
    operator: z.enum(COUNT_OPERATORS),
    value: count,
  }),
  z.object({
    kind: z.literal("customer"),
    is: z.enum(["new", "tagged", "pass_holder"]),
    tag: z.string().trim().min(1).max(40).optional(),
  }),
  /** Exemplaires de matériel de l'événement pas encore attribués à une inscription. */
  z.object({ kind: z.literal("equipment"), operator: z.enum(COUNT_OPERATORS), value: count }),
  // shortcut: « le tarif choisi, une option » attend les tarifs du lot 35 ; ajouter ici une
  // condition `{ kind: "pricing", optionId }` et son cas dans engine.ts quand ils existeront.
]);
export type RuleCondition = z.output<typeof ruleConditionSchema>;

/** Champ demandé par une règle : posé une fois par inscription, toujours requis. */
const askedFieldSchema = z.object({
  key: fieldShape.key,
  label: fieldShape.label,
  type: fieldShape.type,
  help: z.string().trim().max(300).optional(),
  options: fieldShape.options,
});

export const ruleActionSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("ask"), field: askedFieldSchema }),
  /** Texte « À apporter » de la confirmation et du rappel, avec un modèle en PDF au besoin. */
  z.object({
    kind: z.literal("remind_document"),
    label: z.string().trim().min(1, "Indique le document").max(120),
    file: z
      .object({
        name: z.string().trim().min(1).max(120),
        url: z.string().regex(DOCUMENT_URL, "Document inattendu"),
      })
      .optional(),
  }),
  z.object({
    kind: z.literal("refuse"),
    message: z.string().trim().min(1, "Écris le message de refus").max(300),
  }),
  z.object({ kind: z.literal("require_approval") }),
  z.object({
    kind: z.literal("notify_team"),
    message: z.string().trim().max(300).optional(),
  }),
  z.object({
    kind: z.literal("message"),
    subject: z.string().trim().min(1, "Donne un objet au message").max(120),
    body: z.string().trim().min(1, "Écris le message").max(2000),
  }),
  /** Annule la séance par le parcours habituel (e-mails aux inscrits, cartes recréditées). */
  z.object({ kind: z.literal("cancel_event") }),
  // shortcut: « appliquer un tarif ou une réduction » attend le lot 35 (tarifs et options).
]);
export type RuleAction = z.output<typeof ruleActionSchema>;
export type RuleActionKind = RuleAction["kind"];

/** Actions possibles selon le moment : une inscription envoyée peut encore être refusée… */
export const ACTIONS_BY_TRIGGER: Record<RuleTriggerKind, readonly RuleActionKind[]> = {
  booking_submitted: [
    "ask",
    "remind_document",
    "refuse",
    "require_approval",
    "notify_team",
    "message",
  ],
  before_start: ["notify_team", "message", "cancel_event"],
  after_end: ["notify_team", "message"],
  seat_released: ["notify_team"],
  booking_cancelled: ["notify_team", "message"],
};

/** Conditions qui demandent une inscription précise (réponses, client). */
export function needsBooking(condition: RuleCondition, fields: readonly EventTypeField[]): boolean {
  if (condition.kind === "customer") return true;
  if (condition.kind !== "field") return false;
  const field = fields.find((entry) => entry.key === condition.fieldKey);
  return field !== undefined && field.scope !== "event";
}

export const ruleSchema = z
  .object({
    /** Identifiant stable (trace d'exécution) : il ne change pas quand on renomme la règle. */
    id: z.string().regex(/^[a-z0-9-]{1,40}$/, "Identifiant de règle invalide"),
    name: z.string().trim().min(1, "Nomme la règle").max(80),
    trigger: ruleTriggerSchema,
    /** Groupes reliés par « Ou » ; dans un groupe, conditions reliées par « Et ». Vide : toujours. */
    conditions: z.array(z.array(ruleConditionSchema).min(1).max(10)).max(5),
    actions: z.array(ruleActionSchema).min(1, "Ajoute au moins une action").max(6),
  })
  .superRefine((rule, context) => {
    const issue = (path: Array<string | number>, message: string) =>
      context.addIssue({ code: "custom", path, message });
    const allowed = ACTIONS_BY_TRIGGER[rule.trigger.kind];
    rule.actions.forEach((action, index) => {
      if (!allowed.includes(action.kind)) {
        issue(["actions", index], "Cette action ne va pas avec ce moment");
      }
      if (action.kind === "ask") {
        const choices = action.field.type === "choice" || action.field.type === "multi_choice";
        if (choices && !action.field.options?.length) {
          issue(["actions", index], `Indique les choix de « ${action.field.label} »`);
        }
      }
    });
    const asked = rule.actions.flatMap((action) =>
      action.kind === "ask" ? [action.field.key] : [],
    );
    if (new Set(asked).size !== asked.length) issue(["actions"], "Deux questions ont la même clé");
    for (const [kind, label] of [
      ["refuse", "un refus"],
      ["require_approval", "une mise en validation"],
      ["cancel_event", "une annulation"],
    ] as const) {
      if (rule.actions.filter((action) => action.kind === kind).length > 1) {
        issue(["actions"], `Une seule fois ${label} par règle`);
      }
    }
    rule.conditions.forEach((group, groupIndex) => {
      group.forEach((condition, index) => {
        const path = ["conditions", groupIndex, index];
        if (condition.kind === "field" && condition.operator !== "filled") {
          if (condition.value === undefined || condition.value === "") {
            issue(path, "Indique la valeur à comparer");
          }
        }
        if (condition.kind === "customer" && condition.is === "tagged" && !condition.tag) {
          issue(path, "Indique l'étiquette");
        }
        if (condition.kind === "customer" && !BOOKING_TRIGGERS.has(rule.trigger.kind)) {
          issue(path, "Le client n'est connu qu'au moment d'une inscription");
        }
      });
    });
  });
export type Rule = z.output<typeof ruleSchema>;

/** Règles d'un type (ou la copie d'un événement). */
export const eventTypeRulesSchema = z
  .array(ruleSchema)
  .max(20, "20 règles au plus")
  .superRefine((rules, context) => {
    rules.forEach((rule, index) => {
      if (rules.slice(0, index).some((other) => other.id === rule.id)) {
        context.addIssue({
          code: "custom",
          path: [index],
          message: "Deux règles ont le même identifiant",
        });
      }
    });
  });

/* ---------- Catalogue de l'éditeur (encadrés de la maquette 9.4) ---------- */

export const RULE_TRIGGER_LABELS: Record<RuleTriggerKind, string> = {
  booking_submitted: "Une inscription est envoyée",
  before_start: "X jours ou heures avant la séance",
  after_end: "Après la séance",
  seat_released: "Une place se libère",
  booking_cancelled: "Une inscription est annulée",
};

export interface RuleCatalogEntry<K extends string> {
  kind: K;
  label: string;
  /** Lot qui l'apporte, pour ce qui n'est pas encore disponible. */
  soon?: string;
}

export const RULE_CONDITION_CATALOG: ReadonlyArray<
  RuleCatalogEntry<RuleCondition["kind"] | "pricing">
> = [
  { kind: "field", label: "N'importe quel champ du type" },
  { kind: "pricing", label: "Le tarif choisi, une option", soon: "lot 35" },
  { kind: "seats", label: "Le nombre d'inscrits" },
  { kind: "customer", label: "Le client : nouveau, étiquette, carte" },
  { kind: "equipment", label: "Le matériel restant" },
];

export const RULE_ACTION_CATALOG: ReadonlyArray<RuleCatalogEntry<RuleActionKind | "price">> = [
  { kind: "ask", label: "Demander un champ ou une acceptation" },
  { kind: "remind_document", label: "Rappeler d'apporter un document" },
  { kind: "price", label: "Appliquer un tarif ou une réduction", soon: "lot 35" },
  { kind: "refuse", label: "Refuser avec un message" },
  { kind: "require_approval", label: "Mettre en attente de validation" },
  { kind: "notify_team", label: "Prévenir l'équipe" },
  { kind: "message", label: "Envoyer un message au client" },
  { kind: "cancel_event", label: "Annuler la séance" },
];
