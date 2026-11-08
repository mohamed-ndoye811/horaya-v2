import type { EventTypeField, FieldDefinition, FieldValue, FieldValues } from "../fields/model";
import { ValidationError } from "../shared/errors";
import {
  BOOKING_TRIGGERS,
  type CountOperator,
  type FieldOperator,
  needsBooking,
  type Rule,
  type RuleCondition,
  type RuleTrigger,
  type RuleTriggerKind,
} from "./model";

/**
 * Moteur des règles : pur et déterministe. Il évalue des faits déjà chargés ; ce qu'il ne
 * connaît pas (`undefined`) est laissé à l'appelant, qui choisit de le tenir pour vrai
 * (formulaire : on montre la question au cas où) ou pour faux (serveur : tout est connu).
 */
export interface RuleFacts {
  event?: {
    fieldValues: FieldValues;
    /** null : places illimitées. */
    capacity: number | null;
    /** Places prises (en attente et confirmées), sans l'inscription en cours. */
    seatsHeld: number;
    /** Exemplaires de matériel de l'événement pas encore attribués. */
    equipmentLeft: number;
  };
  booking?: { answers: FieldValues; participants: ReadonlyArray<{ answers: FieldValues }> };
  customer?: { isNew: boolean; tags: readonly string[]; hasActivePass: boolean };
}

/* ---------- Cohérence avec les champs du type ---------- */

const ORDERED_TYPES = new Set(["number", "date"]);
const TEXT_TYPES = new Set(["short_text", "long_text", "url", "multi_choice"]);

/**
 * Ce qui ne colle pas entre les règles et les champs du type : champ inconnu, comparaison
 * impossible, réponse d'inscription à un moment qui n'en a pas, question en double.
 */
export function ruleIssues(
  rules: readonly Rule[],
  fields: readonly EventTypeField[],
): Array<{ path: string; message: string }> {
  const issues: Array<{ path: string; message: string }> = [];
  const asked = new Set(fields.map((field) => field.key));
  rules.forEach((rule, ruleIndex) => {
    const at = (path: string, message: string) =>
      issues.push({ path: `rules.${ruleIndex}.${path}`, message: `« ${rule.name} » : ${message}` });
    rule.conditions.forEach((group, groupIndex) => {
      group.forEach((condition, index) => {
        const path = `conditions.${groupIndex}.${index}`;
        if (needsBooking(condition, fields) && !BOOKING_TRIGGERS.has(rule.trigger.kind)) {
          at(path, "les réponses d'inscription ne sont connues qu'au moment d'une inscription");
        }
        if (condition.kind !== "field") return;
        const field = fields.find((entry) => entry.key === condition.fieldKey);
        if (!field) {
          at(path, `le champ « ${condition.fieldKey} » n'existe plus`);
          return;
        }
        const { operator, value } = condition;
        if (
          (operator === "less_than" || operator === "greater_than") &&
          !ORDERED_TYPES.has(field.type)
        ) {
          at(path, `« ${field.label} » ne se compare pas (nombre ou date seulement)`);
        }
        if (operator === "contains" && !TEXT_TYPES.has(field.type)) {
          at(path, `« ${field.label} » : « contient » vaut pour un texte ou un choix multiple`);
        }
        if (
          (operator === "equals" || operator === "not_equals" || operator === "contains") &&
          (field.type === "choice" || field.type === "multi_choice") &&
          !field.options?.includes(String(value))
        ) {
          at(path, `« ${value} » n'est pas un choix de « ${field.label} »`);
        }
        if (field.type === "acceptance" && operator !== "filled") {
          at(path, `une acceptation se teste avec « est cochée »`);
        }
      });
    });
    rule.actions.forEach((action, index) => {
      if (action.kind !== "ask") return;
      if (asked.has(action.field.key)) {
        at(`actions.${index}`, `la clé « ${action.field.key} » est déjà une question`);
      }
      asked.add(action.field.key);
    });
  });
  return issues;
}

export function assertRulesFit(rules: readonly Rule[], fields: readonly EventTypeField[]): void {
  const issues = ruleIssues(rules, fields);
  if (issues.length > 0) {
    throw new ValidationError(issues[0]?.message ?? "Règle invalide", issues);
  }
}

/* ---------- Évaluation ---------- */

const normalize = (text: string) => text.trim().toLowerCase();

type ConditionValue = string | number | boolean | undefined;

function equalsValue(answer: FieldValue, value: ConditionValue) {
  if (Array.isArray(answer)) return answer.includes(String(value));
  if (typeof answer === "boolean") return answer === (value === true || value === "true");
  if (typeof answer === "number") return answer === Number(value);
  return normalize(answer) === normalize(String(value));
}

/** Compare une réponse ; une réponse absente n'est égale à rien (donc « différente » de tout). */
export function compareAnswer(
  field: FieldDefinition,
  answer: FieldValue | undefined,
  operator: FieldOperator,
  value: ConditionValue,
): boolean {
  const empty =
    answer === undefined || answer === "" || (Array.isArray(answer) && answer.length === 0);
  if (operator === "filled") return !empty;
  if (empty) return operator === "not_equals";
  switch (operator) {
    case "equals":
      return equalsValue(answer, value);
    case "not_equals":
      return !equalsValue(answer, value);
    case "contains":
      return Array.isArray(answer)
        ? answer.some((entry) => normalize(entry) === normalize(String(value)))
        : normalize(String(answer)).includes(normalize(String(value)));
    case "less_than":
    case "greater_than": {
      const sign = operator === "less_than" ? -1 : 1;
      if (field.type === "number" && typeof answer === "number") {
        const limit = Number(value);
        return Number.isFinite(limit) && Math.sign(answer - limit) === sign;
      }
      if (field.type === "date" && typeof answer === "string") {
        // Dates civiles AAAA-MM-JJ : l'ordre alphabétique est l'ordre chronologique.
        const other = String(value);
        return answer !== other && (answer < other ? -1 : 1) === sign;
      }
      return false;
    }
  }
}

function compareCount(actual: number, operator: CountOperator, value: number): boolean {
  if (operator === "less_than") return actual < value;
  if (operator === "greater_than") return actual > value;
  return actual === value;
}

/** Une condition : vraie, fausse, ou `undefined` si le fait n'est pas connu. */
export function conditionHolds(
  condition: RuleCondition,
  fields: readonly EventTypeField[],
  facts: RuleFacts,
): boolean | undefined {
  switch (condition.kind) {
    case "field": {
      const field = fields.find((entry) => entry.key === condition.fieldKey);
      if (!field) return false;
      const test = (values: FieldValues) =>
        compareAnswer(field, values[field.key], condition.operator, condition.value);
      if (field.scope === "event") return facts.event ? test(facts.event.fieldValues) : undefined;
      if (!facts.booking) return undefined;
      if (field.scope === "booking") return test(facts.booking.answers);
      // Portée participant : il suffit qu'un participant remplisse la condition.
      return facts.booking.participants.some((participant) => test(participant.answers));
    }
    case "seats": {
      if (!facts.event) return undefined;
      const { capacity, seatsHeld } = facts.event;
      const actual =
        condition.measure === "booked"
          ? seatsHeld
          : capacity === null
            ? Number.POSITIVE_INFINITY
            : Math.max(0, capacity - seatsHeld);
      return compareCount(actual, condition.operator, condition.value);
    }
    case "equipment":
      return facts.event
        ? compareCount(facts.event.equipmentLeft, condition.operator, condition.value)
        : undefined;
    case "customer": {
      const customer = facts.customer;
      if (!customer) return undefined;
      if (condition.is === "new") return customer.isNew;
      if (condition.is === "pass_holder") return customer.hasActivePass;
      const wanted = normalize(condition.tag ?? "");
      return customer.tags.some((tag) => normalize(tag) === wanted);
    }
  }
}

/**
 * La règle s'applique-t-elle ? Sans condition : toujours. Sinon, un groupe dont toutes les
 * conditions sont vraies suffit (« Et » dans un groupe, « Ou » entre les groupes).
 * `unknownIs` : valeur d'un fait inconnu (faux côté serveur, vrai pour un aperçu prudent).
 */
export function ruleMatches(
  rule: Pick<Rule, "conditions">,
  fields: readonly EventTypeField[],
  facts: RuleFacts,
  unknownIs = false,
): boolean {
  if (rule.conditions.length === 0) return true;
  return rule.conditions.some((group) =>
    group.every((condition) => conditionHolds(condition, fields, facts) ?? unknownIs),
  );
}

export const rulesFor = (rules: readonly Rule[], trigger: RuleTriggerKind) =>
  rules.filter((rule) => rule.trigger.kind === trigger);

/* ---------- Inscription envoyée ---------- */

/** Les questions demandées par des règles, comme des champs « une fois par inscription ». */
export function askedFields(rules: readonly Rule[]): EventTypeField[] {
  return rules.flatMap((rule) =>
    rule.actions.flatMap((action) =>
      action.kind === "ask" ? [{ ...action.field, scope: "booking" as const, required: true }] : [],
    ),
  );
}

export interface SubmissionOutcome {
  /** Règles qui s'appliquent, dans l'ordre du type. */
  matched: Rule[];
  /** Questions à poser en plus. */
  asked: EventTypeField[];
  /** Premier refus rencontré, avec son message. */
  refusal: string | null;
  /** Une règle met l'inscription en attente de validation. */
  approval: boolean;
}

/** Ce que les règles « Une inscription est envoyée » font d'une inscription. */
export function submissionOutcome(
  rules: readonly Rule[],
  fields: readonly EventTypeField[],
  facts: RuleFacts,
  unknownIs = false,
): SubmissionOutcome {
  const matched = rulesFor(rules, "booking_submitted").filter((rule) =>
    ruleMatches(rule, fields, facts, unknownIs),
  );
  const actions = matched.flatMap((rule) => rule.actions);
  const refusal = actions.find((action) => action.kind === "refuse");
  return {
    matched,
    asked: askedFields(matched),
    refusal: refusal?.kind === "refuse" ? refusal.message : null,
    approval: actions.some((action) => action.kind === "require_approval"),
  };
}

/**
 * Règles envoyées au formulaire d'inscription : seulement les questions, et des conditions
 * réduites à ce que le formulaire connaît. Ce qui tient à l'événement est tranché ici (rien
 * d'interne ne part chez le visiteur) ; le client et le matériel sont tenus pour vrais (la
 * question s'affiche au cas où, le serveur ne l'exige que si la règle s'applique vraiment).
 */
export function formRules(
  rules: readonly Rule[],
  fields: readonly EventTypeField[],
  event: Omit<NonNullable<RuleFacts["event"]>, "equipmentLeft">,
): Rule[] {
  return rulesFor(rules, "booking_submitted").flatMap((rule) => {
    const actions = rule.actions.filter((action) => action.kind === "ask");
    if (actions.length === 0) return [];
    const groups: RuleCondition[][] = [];
    for (const group of rule.conditions) {
      const kept: RuleCondition[] = [];
      let possible = true;
      for (const condition of group) {
        if (condition.kind === "customer" || condition.kind === "equipment") continue;
        const known = conditionHolds(condition, fields, { event: { ...event, equipmentLeft: 0 } });
        if (known === false) possible = false;
        if (known === undefined) kept.push(condition);
      }
      if (!possible) continue;
      if (kept.length === 0) return [{ ...rule, conditions: [], actions }];
      groups.push(kept);
    }
    return groups.length > 0 || rule.conditions.length === 0
      ? [{ ...rule, conditions: groups, actions }]
      : [];
  });
}

/* ---------- Moments planifiés ---------- */

const HOUR = 3_600_000;

/**
 * Fenêtre où une règle planifiée s'exécute : de X heures avant le début jusqu'au début, ou
 * de la fin de la séance jusqu'à deux jours après. null pour les autres déclencheurs.
 */
export function ruleWindow(
  trigger: RuleTrigger,
  event: { startsAt: Date; endsAt: Date },
): { from: Date; until: Date } | null {
  if (trigger.kind === "before_start") {
    return {
      from: new Date(event.startsAt.getTime() - trigger.hours * HOUR),
      until: event.startsAt,
    };
  }
  if (trigger.kind === "after_end") {
    return { from: event.endsAt, until: new Date(event.endsAt.getTime() + 48 * HOUR) };
  }
  return null;
}

export function isRuleDue(
  trigger: RuleTrigger,
  event: { startsAt: Date; endsAt: Date },
  now: Date,
): boolean {
  const window = ruleWindow(trigger, event);
  return window !== null && now >= window.from && now < window.until;
}
