import type { EventTypeField } from "../fields/model";
import {
  BOOKING_TRIGGERS,
  type Rule,
  type RuleAction,
  type RuleCondition,
  type RuleTrigger,
} from "./model";

/**
 * Phrase en clair d'une règle (éditeur, liste de la section 5) et lignes du journal : la règle
 * se lit comme l'atelier l'aurait dite.
 */

/** « a, b et c ». */
export function listJoin(parts: readonly string[]): string {
  if (parts.length <= 1) return parts[0] ?? "";
  return `${parts.slice(0, -1).join(", ")} et ${parts.at(-1)}`;
}

/** « J-7 », « 3 h avant », « Inscription »… : l'étiquette du moment dans la liste. */
export function ruleMomentLabel(trigger: RuleTrigger): string {
  switch (trigger.kind) {
    case "booking_submitted":
      return "Inscription";
    case "before_start":
      return trigger.hours % 24 === 0 ? `J-${trigger.hours / 24}` : `${trigger.hours} h avant`;
    case "after_end":
      return "Après";
    case "seat_released":
      return "Place libérée";
    case "booking_cancelled":
      return "Annulation";
  }
}

/** Début de la phrase : « À chaque inscription », « À J-7 »… */
export function ruleWhen(trigger: RuleTrigger): string {
  switch (trigger.kind) {
    case "booking_submitted":
      return "À chaque inscription";
    case "before_start":
      return trigger.hours % 24 === 0
        ? `À J-${trigger.hours / 24}`
        : `${trigger.hours} h avant la séance`;
    case "after_end":
      return "Après la séance";
    case "seat_released":
      return "Quand une place se libère";
    case "booking_cancelled":
      return "Quand une inscription est annulée";
  }
}

function valueText(
  field: EventTypeField | undefined,
  value: string | number | boolean | undefined,
) {
  if (typeof value === "boolean") return value ? "oui" : "non";
  if (field?.type === "boolean") return value === "true" ? "oui" : "non";
  if (field?.type === "date" && typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return new Date(`${value}T12:00:00Z`).toLocaleDateString("fr-FR", {
      day: "numeric",
      month: "long",
      year: "numeric",
      timeZone: "UTC",
    });
  }
  return String(value ?? "");
}

const places = (count: number) => `${count} place${count > 1 ? "s" : ""}`;

/** Une condition en clair : « un participant a moins de 16 ans », « il reste des places ». */
export function describeCondition(
  condition: RuleCondition,
  fields: readonly EventTypeField[],
): string {
  switch (condition.kind) {
    case "field": {
      const field = fields.find((entry) => entry.key === condition.fieldKey);
      const label = `« ${field?.label ?? condition.fieldKey} »`;
      const value = valueText(field, condition.value);
      const date = field?.type === "date";
      if (field?.scope === "participant" && field.type === "number" && field.key === "age") {
        if (condition.operator === "less_than") return `un participant a moins de ${value} ans`;
        if (condition.operator === "greater_than") return `un participant a plus de ${value} ans`;
      }
      const base = (() => {
        switch (condition.operator) {
          case "equals":
            return `${label} est ${value}`;
          case "not_equals":
            return `${label} n'est pas ${value}`;
          case "contains":
            return `${label} contient ${value}`;
          case "less_than":
            return date ? `${label} est avant le ${value}` : `${label} est inférieur à ${value}`;
          case "greater_than":
            return date ? `${label} est après le ${value}` : `${label} est supérieur à ${value}`;
          case "filled":
            return field?.type === "acceptance" ? `${label} est cochée` : `${label} est rempli`;
        }
      })();
      return field?.scope === "participant" ? `pour un participant, ${base}` : base;
    }
    case "seats": {
      const { operator, value } = condition;
      if (condition.measure === "remaining") {
        if (operator === "greater_than" && value === 0) return "il reste des places";
        if (operator === "equals" && value === 0) return "c'est complet";
        if (operator === "less_than") return `il reste moins de ${places(value)}`;
        if (operator === "greater_than") return `il reste plus de ${places(value)}`;
        return `il reste ${places(value)}`;
      }
      const inscrits = `${value} inscrit${value > 1 ? "s" : ""}`;
      if (operator === "less_than") return `il y a moins de ${inscrits}`;
      if (operator === "greater_than") return `il y a plus de ${inscrits}`;
      return `il y a ${inscrits}`;
    }
    case "customer":
      if (condition.is === "new") return "le client est nouveau";
      if (condition.is === "pass_holder") return "le client a une carte de séances active";
      return `le client porte l'étiquette « ${condition.tag ?? ""} »`;
    case "equipment": {
      const units = `${condition.value} exemplaire${condition.value > 1 ? "s" : ""} de matériel`;
      if (condition.operator === "less_than") return `il reste moins de ${units}`;
      if (condition.operator === "greater_than") return `il reste plus de ${units}`;
      return `il reste ${units}`;
    }
  }
}

/** « A et B » ; « et qu'il reste… » quand la suite commence par « il ». */
const and = (parts: string[]) =>
  parts.reduce((sentence, part, index) =>
    index === 0 ? part : `${sentence} et ${part.startsWith("il ") ? `qu'${part}` : part}`,
  );

/** Les conditions en clair, sans le « si » de tête : « A et B, ou si C ». null sans condition. */
export function describeConditions(
  conditions: Rule["conditions"],
  fields: readonly EventTypeField[],
): string | null {
  if (conditions.length === 0) return null;
  return conditions
    .map((group) => and(group.map((condition) => describeCondition(condition, fields))))
    .join(", ou si ");
}

/** Une action à l'infinitif : « demander d'accepter « … » », « prévenir l'équipe ». */
export function describeAction(action: RuleAction, trigger: RuleTrigger): string {
  switch (action.kind) {
    case "ask":
      return action.field.type === "acceptance"
        ? `demander d'accepter « ${action.field.label} »`
        : `demander « ${action.field.label} »`;
    case "remind_document":
      return `rappeler d'apporter ${action.label}${action.file ? ", avec le modèle en PDF" : ""}`;
    case "refuse":
      return `refuser l'inscription (« ${action.message} »)`;
    case "require_approval":
      return "mettre l'inscription en attente de validation";
    case "notify_team":
      return "prévenir l'équipe";
    case "message":
      return `envoyer « ${action.subject} » ${BOOKING_TRIGGERS.has(trigger.kind) ? "au client" : "aux inscrits"}`;
    case "cancel_event":
      return "annuler la séance";
  }
}

export interface RuleDescription {
  /** « À chaque inscription ». */
  when: string;
  /** « un participant a moins de 16 ans », null sans condition. */
  condition: string | null;
  /** « demander … et rappeler … ». */
  actions: string;
}

export function describeRule(
  rule: Pick<Rule, "trigger" | "conditions" | "actions">,
  fields: readonly EventTypeField[],
): RuleDescription {
  return {
    when: ruleWhen(rule.trigger),
    condition: describeConditions(rule.conditions, fields),
    actions: listJoin(rule.actions.map((action) => describeAction(action, rule.trigger))),
  };
}

/** La phrase complète : « À chaque inscription, si un participant a moins de 16 ans, demander … ». */
export function ruleSentence(
  rule: Pick<Rule, "trigger" | "conditions" | "actions">,
  fields: readonly EventTypeField[],
): string {
  const { when, condition, actions } = describeRule(rule, fields);
  return `${when}, ${condition ? `si ${condition}, ` : ""}${actions}.`;
}

/** Ce qu'une action a fait, pour le journal : « accord demandé », « équipe prévenue ». */
export function ruleActionDone(action: RuleAction): string {
  switch (action.kind) {
    case "ask":
      return action.field.type === "acceptance"
        ? "accord demandé"
        : `« ${action.field.label} » demandé`;
    case "remind_document":
      return `rappel d'apporter ${action.label}`;
    case "refuse":
      return "inscription refusée";
    case "require_approval":
      return "mise en attente de validation";
    case "notify_team":
      return "équipe prévenue";
    case "message":
      return `message « ${action.subject} » envoyé`;
    case "cancel_event":
      return "séance annulée";
  }
}

/** Ligne du journal : « Règle « Autorisation des mineurs » : accord demandé ». */
export function ruleJournalLine(name: string, actions: readonly RuleAction[]): string {
  return `Règle « ${name} » : ${listJoin(actions.map(ruleActionDone))}`;
}
