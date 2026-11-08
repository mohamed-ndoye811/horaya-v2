import {
  ACTIONS_BY_TRIGGER,
  BOOKING_TRIGGERS,
  type CountOperator,
  conditionHolds,
  describeCondition,
  describeRule,
  type EventTypeField,
  FIELD_TYPES,
  type FieldOperator,
  type FieldType,
  listJoin,
  type PricingModule,
  parseFieldValues,
  RULE_ACTION_CATALOG,
  RULE_CONDITION_CATALOG,
  RULE_TRIGGER_LABELS,
  RULE_TRIGGERS,
  type Rule,
  type RuleAction,
  type RuleCondition,
  type RuleFacts,
  type RuleTrigger,
  ruleActionDone,
  ruleIssues,
  ruleMatches,
  ruleMomentLabel,
  ruleSchema,
} from "@horaya/core";
import { type ReactNode, useEffect, useState } from "react";
import { FieldInputs } from "@/components/app/field-inputs";
import { Collapse, Disclosure } from "@/components/motion/collapse";
import { PresenceItem, PresenceList } from "@/components/motion/presence";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Field, FieldError, inputClasses, textareaClasses } from "@/components/ui/field";
import { ChevronRight, CloseIcon, PlusIcon } from "@/components/ui/icons";
import { Select } from "@/components/ui/select";
import { getRuleTestFacts } from "@/functions/events";
import { cn } from "@/lib/cn";
import { FIELD_TYPE_LABELS, rawFieldValues } from "@/lib/fields";
import { centsToInput, parseEuroToCents } from "@/lib/money";
import { keyFor } from "./field-list-editor";

/** Règle en cours d'édition : `null` fermé, `"new"` une nouvelle, sinon son rang. */
export type RuleEditing = number | "new" | null;

export interface RuleEditorContext {
  /** Nom du type (« COURS DE TOURNAGE · RÈGLE 1 SUR 3 »). */
  typeName: string;
  fields: EventTypeField[];
  /** Documents joints du type : modèles possibles pour « Rappeler d'apporter un document ». */
  documents: Array<{ name: string; url: string }>;
  /** Dernières inscriptions aux événements du type. */
  testBookings: Array<{ id: string; label: string }>;
  /** Module « Tarifs et options » du type (conditions et actions de prix). */
  pricing: PricingModule | undefined;
}

const labelClasses = "text-xs font-bold uppercase leading-4 tracking-[0.06em] text-ink-subtle";

/** « Si … , alors … » (liste de la section 5). */
function ListSentence({ rule, context }: { rule: Rule; context: RuleEditorContext }) {
  const { condition, actions } = describeRule(rule, context.fields, context.pricing);
  return condition ? (
    <>
      <strong>Si</strong> {condition}, <strong>alors</strong> {actions}
    </>
  ) : (
    <>
      <strong>Toujours</strong>, {actions}
    </>
  );
}

/** Maquette 9.1, section 5 : les règles en phrases, leur moment en étiquette. */
export function RuleList({
  rules,
  onChange,
  editing,
  setEditing,
  context,
  error,
}: {
  rules: Rule[];
  onChange: (next: Rule[]) => void;
  editing: RuleEditing;
  setEditing: (editing: RuleEditing) => void;
  context: RuleEditorContext;
  error?: string;
}) {
  const current = editing === "new" ? null : editing === null ? undefined : rules[editing];
  return (
    <div className="relative flex flex-col gap-2">
      {rules.length === 0 && (
        <p className="text-sm leading-5 text-ink-muted">
          Une règle fait agir Horaya à partir d'une information : demander l'accord d'un parent,
          rappeler un document, prévenir l'équipe s'il reste des places…
        </p>
      )}
      <PresenceList>
        {rules.map((rule, index) => (
          <PresenceItem key={rule.id}>
            <button
              type="button"
              onClick={() => setEditing(index)}
              className="press flex w-full items-center gap-3.5 rounded-[14px] bg-field px-3.5 py-3 text-left hover:bg-line-soft"
            >
              <span className="w-[92px] shrink-0 text-[11px] font-bold uppercase leading-[14px] tracking-[0.06em] text-ink-subtle">
                {ruleMomentLabel(rule.trigger)}
              </span>
              <span className="flex min-w-0 grow flex-col gap-0.5">
                <span className="text-[13px] font-semibold leading-4 text-ink-muted">
                  {rule.name}
                </span>
                <span className="text-sm leading-[19px] text-ink">
                  <ListSentence rule={rule} context={context} />
                </span>
              </span>
              <ChevronRight className="shrink-0 text-ink-subtle" />
            </button>
          </PresenceItem>
        ))}
      </PresenceList>
      <button
        type="button"
        onClick={() => setEditing("new")}
        className="flex items-center gap-2.5 self-start pt-2 text-sm font-semibold leading-[18px] text-link hover:underline"
      >
        <PlusIcon size={10} />
        Créer une règle
      </button>
      {error && <FieldError>{error}</FieldError>}
      {current !== undefined && (
        <RuleDialog
          key={current?.id ?? "new"}
          initial={current}
          position={editing === "new" ? rules.length + 1 : (editing ?? 0) + 1}
          total={editing === "new" ? rules.length + 1 : rules.length}
          others={rules.filter((rule) => rule !== current)}
          context={context}
          onClose={() => setEditing(null)}
          onSave={(saved) => {
            onChange(
              current ? rules.map((rule) => (rule === current ? saved : rule)) : [...rules, saved],
            );
            setEditing(null);
          }}
          onDelete={
            current
              ? () => {
                  onChange(rules.filter((rule) => rule !== current));
                  setEditing(null);
                }
              : undefined
          }
        />
      )}
    </div>
  );
}

/* ---------- Constructeur ---------- */

const SCOPE_PREFIX = { event: "Événement", booking: "Inscription", participant: "Participant" };

function operatorsFor(type: FieldType): FieldOperator[] {
  switch (type) {
    case "number":
    case "date":
      return ["less_than", "greater_than", "equals", "not_equals", "filled"];
    case "choice":
      return ["equals", "not_equals", "filled"];
    case "multi_choice":
      return ["contains", "filled"];
    case "boolean":
      return ["equals"];
    case "acceptance":
      return ["filled"];
    default:
      return ["equals", "not_equals", "contains", "filled"];
  }
}

function operatorLabel(operator: FieldOperator, type: FieldType): string {
  const date = type === "date";
  switch (operator) {
    case "equals":
      return "est";
    case "not_equals":
      return "n'est pas";
    case "contains":
      return "contient";
    case "less_than":
      return date ? "est avant le" : "est inférieur à";
    case "greater_than":
      return date ? "est après le" : "est supérieur à";
    case "filled":
      return type === "acceptance" ? "est cochée" : "est rempli";
  }
}

const COUNT_LABELS: Record<CountOperator, string> = {
  greater_than: "supérieur à",
  less_than: "inférieur à",
  equals: "égal à",
};

const subjectOf = (condition: RuleCondition) =>
  condition.kind === "field"
    ? `field:${condition.fieldKey}`
    : condition.kind === "seats"
      ? `seats:${condition.measure}`
      : condition.kind === "customer"
        ? `customer:${condition.is}`
        : condition.kind === "pricing"
          ? `pricing:${condition.target}:${condition.id}`
          : "equipment";

function conditionFor(subject: string, fields: EventTypeField[]): RuleCondition {
  const [kind, detail = ""] = subject.split(":");
  if (kind === "field") {
    const field = fields.find((entry) => entry.key === detail);
    const operator = operatorsFor(field?.type ?? "short_text")[0] ?? "equals";
    const value =
      field?.type === "boolean" ? true : field?.type === "choice" ? field.options?.[0] : undefined;
    return { kind: "field", fieldKey: detail, operator, ...(value !== undefined && { value }) };
  }
  if (kind === "seats") {
    return detail === "remaining"
      ? { kind: "seats", measure: "remaining", operator: "greater_than", value: 0 }
      : { kind: "seats", measure: "booked", operator: "less_than", value: 4 };
  }
  if (kind === "customer") {
    const is = detail as "new" | "tagged" | "pass_holder";
    return is === "tagged" ? { kind: "customer", is, tag: "" } : { kind: "customer", is };
  }
  if (kind === "pricing") {
    const [, target, id = ""] = subject.split(":");
    return { kind: "pricing", target: target === "option" ? "option" : "rate", id };
  }
  return { kind: "equipment", operator: "less_than", value: 1 };
}

function actionFor(kind: RuleAction["kind"]): RuleAction {
  switch (kind) {
    case "ask":
      return { kind, field: { key: "", label: "", type: "acceptance" } };
    case "remind_document":
      return { kind, label: "" };
    case "refuse":
      return { kind, message: "" };
    case "message":
      return { kind, subject: "", body: "" };
    case "price":
      return { kind, apply: "percent", percent: 10 };
    default:
      return { kind } as RuleAction;
  }
}

/** Petite pilule de saisie du constructeur (36 px, fond gris, contour clair). */
const pillInput = inputClasses("xs", "none", "fit");

function ValueInput({
  field,
  value,
  onChange,
}: {
  field: EventTypeField | undefined;
  value: string | number | boolean | undefined;
  onChange: (value: string | number | boolean) => void;
}) {
  if (field?.type === "boolean") {
    return (
      <Select
        variant="dense"
        aria-label="Réponse"
        value={value === false || value === "false" ? "false" : "true"}
        onChange={(event) => onChange(event.target.value === "true")}
        className="w-28"
      >
        <option value="true">oui</option>
        <option value="false">non</option>
      </Select>
    );
  }
  if (field?.type === "choice" || field?.type === "multi_choice") {
    return (
      <Select
        variant="dense"
        aria-label="Réponse"
        value={String(value ?? "")}
        onChange={(event) => onChange(event.target.value)}
        className="min-w-36"
      >
        {(field.options ?? []).map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </Select>
    );
  }
  const number = field?.type === "number";
  return (
    <input
      aria-label="Valeur"
      type={field?.type === "date" ? "date" : "text"}
      inputMode={number ? "decimal" : undefined}
      value={value === undefined ? "" : String(value)}
      onChange={(event) => {
        const text = event.target.value;
        const parsed = Number(text.replace(",", "."));
        onChange(number && text.trim() !== "" && Number.isFinite(parsed) ? parsed : text);
      }}
      className={cn(pillInput, number ? "w-[72px]" : "w-44")}
    />
  );
}

function CountInput({ value, onChange }: { value: number; onChange: (value: number) => void }) {
  return (
    <input
      aria-label="Nombre"
      inputMode="numeric"
      value={String(value)}
      onChange={(event) => onChange(Math.max(0, Math.trunc(Number(event.target.value) || 0)))}
      className={cn(pillInput, "w-[72px]")}
    />
  );
}

function RemoveButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className="flex size-8 shrink-0 items-center justify-center rounded-full text-ink-subtle hover:bg-field hover:text-ink"
    >
      <CloseIcon size={10} />
    </button>
  );
}

function ConditionRow({
  condition,
  onChange,
  onRemove,
  fields,
  bookingKnown,
  pricing,
  prefix,
}: {
  condition: RuleCondition;
  onChange: (next: RuleCondition) => void;
  onRemove: () => void;
  fields: EventTypeField[];
  /** Le déclencheur porte sur une inscription : réponses et client sont connus. */
  bookingKnown: boolean;
  pricing: PricingModule | undefined;
  /** « et », « ou » devant la condition (rien pour la première). */
  prefix: string;
}) {
  const field =
    condition.kind === "field"
      ? fields.find((entry) => entry.key === condition.fieldKey)
      : undefined;
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="w-5 shrink-0 text-[13px] font-semibold text-ink-subtle">{prefix}</span>
      <Select
        variant="dense"
        aria-label="Information testée"
        value={subjectOf(condition)}
        onChange={(event) => onChange(conditionFor(event.target.value, fields))}
        className="min-w-40 flex-1"
      >
        {(["event", "booking", "participant"] as const).map((scope) => {
          const scoped = fields.filter(
            (entry) => entry.scope === scope && (scope === "event" || bookingKnown),
          );
          return scoped.length > 0 ? (
            <optgroup key={scope} label={SCOPE_PREFIX[scope]}>
              {scoped.map((entry) => (
                <option key={entry.key} value={`field:${entry.key}`}>
                  {SCOPE_PREFIX[scope]} · {entry.label}
                </option>
              ))}
            </optgroup>
          ) : null;
        })}
        <optgroup label="Places et matériel">
          <option value="seats:remaining">Places restantes</option>
          <option value="seats:booked">Nombre d'inscrits</option>
          <option value="equipment">Matériel restant</option>
        </optgroup>
        {bookingKnown && (
          <optgroup label="Client">
            <option value="customer:new">Le client est nouveau</option>
            <option value="customer:tagged">Le client porte l'étiquette…</option>
            <option value="customer:pass_holder">Le client a une carte de séances active</option>
          </optgroup>
        )}
        {bookingKnown && (
          <optgroup label="Tarif et options">
            {(pricing?.rates ?? [{ id: "plein", name: "Plein" }]).map((rate) => (
              <option key={rate.id} value={`pricing:rate:${rate.id}`}>
                Le tarif « {rate.name} » est choisi
              </option>
            ))}
            {(pricing?.options ?? []).map((option) => (
              <option key={option.id} value={`pricing:option:${option.id}`}>
                L'option « {option.name} » est prise
              </option>
            ))}
          </optgroup>
        )}
        {condition.kind === "field" && !field && (
          <option value={subjectOf(condition)}>Champ retiré : {condition.fieldKey}</option>
        )}
      </Select>
      {condition.kind === "field" && field && (
        <>
          {operatorsFor(field.type).length > 1 && (
            <Select
              variant="dense"
              aria-label="Comparaison"
              value={condition.operator}
              onChange={(event) =>
                onChange({ ...condition, operator: event.target.value as FieldOperator })
              }
              className="min-w-36"
            >
              {operatorsFor(field.type).map((operator) => (
                <option key={operator} value={operator}>
                  {operatorLabel(operator, field.type)}
                </option>
              ))}
            </Select>
          )}
          {operatorsFor(field.type).length === 1 && (
            <span className="text-sm font-semibold text-ink">
              {operatorLabel(condition.operator, field.type)}
            </span>
          )}
          {condition.operator !== "filled" && (
            <ValueInput
              field={field}
              value={condition.value}
              onChange={(value) => onChange({ ...condition, value })}
            />
          )}
        </>
      )}
      {(condition.kind === "seats" || condition.kind === "equipment") && (
        <>
          <Select
            variant="dense"
            aria-label="Comparaison"
            value={condition.operator}
            onChange={(event) =>
              onChange({ ...condition, operator: event.target.value as CountOperator })
            }
            className="min-w-32"
          >
            {(Object.keys(COUNT_LABELS) as CountOperator[]).map((operator) => (
              <option key={operator} value={operator}>
                {COUNT_LABELS[operator]}
              </option>
            ))}
          </Select>
          <CountInput
            value={condition.value}
            onChange={(value) => onChange({ ...condition, value })}
          />
        </>
      )}
      {condition.kind === "customer" && condition.is === "tagged" && (
        <input
          aria-label="Étiquette"
          value={condition.tag ?? ""}
          maxLength={40}
          placeholder="Adhérent"
          onChange={(event) => onChange({ ...condition, tag: event.target.value })}
          className={cn(pillInput, "w-40")}
        />
      )}
      <RemoveButton label="Retirer la condition" onClick={onRemove} />
    </div>
  );
}

function ActionRow({
  action,
  trigger,
  onChange,
  onRemove,
  documents,
  pricing,
}: {
  action: RuleAction;
  trigger: RuleTrigger;
  onChange: (next: RuleAction) => void;
  onRemove: () => void;
  documents: RuleEditorContext["documents"];
  pricing: PricingModule | undefined;
}) {
  const allowed = ACTIONS_BY_TRIGGER[trigger.kind];
  const toBooking = BOOKING_TRIGGERS.has(trigger.kind);
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex flex-wrap items-center gap-1.5">
        <Select
          variant="dense"
          aria-label="Action"
          value={action.kind}
          onChange={(event) => onChange(actionFor(event.target.value as RuleAction["kind"]))}
          className="min-w-44"
        >
          {RULE_ACTION_CATALOG.map((entry) => (
            <option key={entry.kind} value={entry.kind} disabled={!allowed.includes(entry.kind)}>
              {entry.kind === "message" && !toBooking
                ? "Envoyer un message aux inscrits"
                : entry.label}
            </option>
          ))}
        </Select>
        {action.kind === "ask" && (
          <>
            <Select
              variant="dense"
              aria-label="Type de question"
              value={action.field.type}
              onChange={(event) =>
                onChange({
                  ...action,
                  field: { ...action.field, type: event.target.value as FieldType },
                })
              }
              className="min-w-36"
            >
              {FIELD_TYPES.map((type) => (
                <option key={type} value={type}>
                  {FIELD_TYPE_LABELS[type]}
                </option>
              ))}
            </Select>
            <input
              aria-label={action.field.type === "acceptance" ? "Texte à accepter" : "Question"}
              value={action.field.label}
              maxLength={200}
              placeholder={
                action.field.type === "acceptance"
                  ? "Je suis son représentant légal et j'autorise sa participation"
                  : "Question à poser"
              }
              onChange={(event) =>
                onChange({ ...action, field: { ...action.field, label: event.target.value } })
              }
              className={cn(pillInput, "min-w-40 flex-1")}
            />
          </>
        )}
        {action.kind === "remind_document" && (
          <>
            <input
              aria-label="Document à apporter"
              value={action.label}
              maxLength={120}
              placeholder="l'autorisation signée"
              onChange={(event) => onChange({ ...action, label: event.target.value })}
              className={cn(pillInput, "min-w-40 flex-1")}
            />
            {documents.length > 0 && (
              <Select
                variant="dense"
                aria-label="Modèle en PDF"
                value={action.file?.url ?? ""}
                onChange={(event) => {
                  const file = documents.find((entry) => entry.url === event.target.value);
                  const { file: _file, ...rest } = action;
                  onChange(file ? { ...rest, file } : rest);
                }}
                className="min-w-44"
              >
                <option value="">Sans modèle PDF</option>
                {documents.map((document) => (
                  <option key={document.url} value={document.url}>
                    {document.name} (PDF joint)
                  </option>
                ))}
              </Select>
            )}
          </>
        )}
        {action.kind === "refuse" && (
          <input
            aria-label="Message de refus"
            value={action.message}
            maxLength={300}
            placeholder="Ce cours est réservé aux plus de 16 ans"
            onChange={(event) => onChange({ ...action, message: event.target.value })}
            className={cn(pillInput, "min-w-40 flex-1")}
          />
        )}
        {action.kind === "notify_team" && (
          <input
            aria-label="Message à l'équipe"
            value={action.message ?? ""}
            maxLength={300}
            placeholder="Message à l'équipe (facultatif)"
            onChange={(event) =>
              onChange(
                event.target.value
                  ? { ...action, message: event.target.value }
                  : { kind: "notify_team" },
              )
            }
            className={cn(pillInput, "min-w-40 flex-1")}
          />
        )}
        {action.kind === "price" && (
          <PriceActionInputs action={action} onChange={onChange} pricing={pricing} />
        )}
        {action.kind === "message" && (
          <input
            aria-label="Objet"
            value={action.subject}
            maxLength={120}
            placeholder="Objet de l'e-mail"
            onChange={(event) => onChange({ ...action, subject: event.target.value })}
            className={cn(pillInput, "min-w-40 flex-1")}
          />
        )}
        <RemoveButton label="Retirer l'action" onClick={onRemove} />
      </div>
      {action.kind === "ask" &&
        (action.field.type === "choice" || action.field.type === "multi_choice") && (
          <input
            aria-label="Choix"
            value={(action.field.options ?? []).join(", ")}
            placeholder="Choix séparés par des virgules"
            onChange={(event) =>
              onChange({
                ...action,
                field: {
                  ...action.field,
                  options: event.target.value
                    .split(",")
                    .map((option) => option.trim())
                    .filter(Boolean),
                },
              })
            }
            className={pillInput}
          />
        )}
      {action.kind === "message" && (
        <textarea
          aria-label="Message"
          value={action.body}
          rows={3}
          maxLength={2000}
          placeholder={toBooking ? "Ce que reçoit le client" : "Ce que reçoit chaque inscrit"}
          onChange={(event) => onChange({ ...action, body: event.target.value })}
          className={textareaClasses()}
        />
      )}
    </div>
  );
}

/** « Appliquer un tarif ou une réduction » : passage à un tarif, ou réduction en % ou en €. */
function PriceActionInputs({
  action,
  onChange,
  pricing,
}: {
  action: Extract<RuleAction, { kind: "price" }>;
  onChange: (next: RuleAction) => void;
  pricing: PricingModule | undefined;
}) {
  const rates = pricing?.rates ?? [{ id: "plein", name: "Plein" }];
  return (
    <>
      <Select
        variant="dense"
        aria-label="Changement de prix"
        value={action.apply}
        onChange={(event) => {
          const apply = event.target.value as typeof action.apply;
          onChange(
            apply === "rate"
              ? { kind: "price", apply, rateId: rates[0]?.id ?? "plein" }
              : apply === "percent"
                ? { kind: "price", apply, percent: 10 }
                : { kind: "price", apply, amountCents: 500 },
          );
        }}
        className="min-w-44"
      >
        <option value="percent">Réduction en %</option>
        <option value="amount">Réduction en €</option>
        <option value="rate">Passer au tarif…</option>
      </Select>
      {action.apply === "rate" ? (
        <Select
          variant="dense"
          aria-label="Tarif"
          value={action.rateId ?? ""}
          onChange={(event) => onChange({ ...action, rateId: event.target.value })}
          className="min-w-36"
        >
          {rates.map((rate) => (
            <option key={rate.id} value={rate.id}>
              {rate.name}
            </option>
          ))}
        </Select>
      ) : (
        <ReductionInput key={action.apply} action={action} onChange={onChange} />
      )}
      {action.apply !== "rate" && (
        <span className="text-sm font-semibold text-ink">
          {action.apply === "percent" ? "%" : "€"}
        </span>
      )}
    </>
  );
}

/** Montant ou pourcentage : le texte reste tel que saisi (« 12, »), la règle reçoit l'entier. */
function ReductionInput({
  action,
  onChange,
}: {
  action: Extract<RuleAction, { kind: "price" }>;
  onChange: (next: RuleAction) => void;
}) {
  const percent = action.apply === "percent";
  const [text, setText] = useState(() =>
    percent ? String(action.percent ?? "") : centsToInput(action.amountCents ?? 0),
  );
  return (
    <input
      aria-label={percent ? "Pourcentage" : "Montant en euros"}
      inputMode="decimal"
      value={text}
      onChange={(event) => {
        setText(event.target.value);
        const parsed = percent
          ? Math.trunc(Number(event.target.value))
          : parseEuroToCents(event.target.value);
        const value = Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
        onChange(percent ? { ...action, percent: value } : { ...action, amountCents: value });
      }}
      className={cn(pillInput, "w-[72px]")}
    />
  );
}

function BuilderRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5 sm:flex-row sm:items-start sm:gap-3">
      <p className={cn(labelClasses, "shrink-0 sm:w-12 sm:pt-2.5")}>{label}</p>
      <div className="flex min-w-0 grow flex-col gap-1.5">{children}</div>
    </div>
  );
}

function TriggerInput({
  trigger,
  onChange,
}: {
  trigger: RuleTrigger;
  onChange: (trigger: RuleTrigger) => void;
}) {
  const days = trigger.kind === "before_start" && trigger.hours % 24 === 0;
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <Select
        variant="dense"
        aria-label="Quand"
        value={trigger.kind}
        onChange={(event) => {
          const kind = event.target.value as RuleTrigger["kind"];
          onChange(kind === "before_start" ? { kind, hours: 7 * 24 } : ({ kind } as RuleTrigger));
        }}
        className="min-w-52"
      >
        {RULE_TRIGGERS.map((kind) => (
          <option key={kind} value={kind}>
            {kind === "before_start" ? "Avant la séance" : RULE_TRIGGER_LABELS[kind]}
          </option>
        ))}
      </Select>
      {trigger.kind === "before_start" && (
        <>
          <CountInput
            value={days ? trigger.hours / 24 : trigger.hours}
            onChange={(value) =>
              onChange({ ...trigger, hours: Math.max(1, value) * (days ? 24 : 1) })
            }
          />
          <Select
            variant="dense"
            aria-label="Unité"
            value={days ? "days" : "hours"}
            onChange={(event) => {
              const amount = days ? trigger.hours / 24 : trigger.hours;
              onChange({ ...trigger, hours: event.target.value === "days" ? amount * 24 : amount });
            }}
            className="w-32"
          >
            <option value="days">jours avant</option>
            <option value="hours">heures avant</option>
          </Select>
        </>
      )}
    </div>
  );
}

/** Encadrés des possibilités (bas de la maquette 9.4), repliés derrière une ligne. */
function Possibilities() {
  const boxes: Array<[string, Array<{ label: string; soon?: string }>]> = [
    ["Quand", RULE_TRIGGERS.map((kind) => ({ label: RULE_TRIGGER_LABELS[kind] }))],
    ["Si", [...RULE_CONDITION_CATALOG]],
    ["Alors", [...RULE_ACTION_CATALOG]],
  ];
  return (
    <Disclosure
      summary={(open) => (
        <>
          <ChevronRight className={cn("transition-transform", open && "rotate-90")} />
          Ce que tu peux combiner
        </>
      )}
      summaryClassName="flex items-center gap-2 text-[13px] font-semibold leading-[18px] text-ink-muted hover:text-ink"
    >
      <div className="grid gap-2 pt-2.5 sm:grid-cols-3">
        {boxes.map(([title, entries]) => (
          <div key={title} className="flex flex-col gap-1.5 rounded-xl bg-field p-3">
            <p className={labelClasses}>{title}</p>
            <ul className="text-[13px] leading-[19px] text-ink-soft">
              {entries.map((entry) => (
                <li key={entry.label} className={cn(entry.soon && "text-ink-subtle")}>
                  {entry.label}
                  {entry.soon && " · bientôt"}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </Disclosure>
  );
}

/* ---------- Tester sur une inscription ---------- */

const STATE_LABELS = {
  true: { text: "oui", className: "bg-success-bg text-success" },
  false: { text: "non", className: "bg-danger-bg text-danger" },
  unknown: { text: "inconnu", className: "bg-line-soft text-ink-muted" },
};

function RuleTest({ rule, context }: { rule: Rule; context: RuleEditorContext }) {
  const [source, setSource] = useState(context.testBookings[0]?.id ?? "fictif");
  const [loaded, setLoaded] = useState<{ id: string; facts: RuleFacts } | null>(null);
  const [fictive, setFictive] = useState<RuleFacts>({});
  const [error, setError] = useState<string | null>(null);
  const fields = context.fields;
  const used = fields.filter((field) =>
    rule.conditions.some((group) =>
      group.some((condition) => condition.kind === "field" && condition.fieldKey === field.key),
    ),
  );

  const loadedId = loaded?.id;
  useEffect(() => {
    if (source === "fictif" || loadedId === source) return;
    let current = true;
    getRuleTestFacts(source)
      .then((facts) => current && setLoaded({ id: source, facts }))
      .catch(() => current && setError("Inscription illisible."));
    return () => {
      current = false;
    };
  }, [source, loadedId]);
  const loading = source !== "fictif" && loadedId !== source && !error;

  const facts = source === "fictif" ? fictive : loaded?.id === source ? loaded.facts : null;
  const matched = facts ? ruleMatches(rule, fields, facts) : false;

  return (
    <div className="flex flex-col gap-2.5 rounded-xl bg-field p-3">
      <div className="flex flex-wrap items-center gap-2">
        <p className="text-[13px] font-semibold text-ink">Tester sur</p>
        <Select
          variant="dense"
          aria-label="Inscription à tester"
          value={source}
          onChange={(event) => {
            setSource(event.target.value);
            setError(null);
          }}
          className="min-w-40 flex-1"
        >
          {context.testBookings.map((booking) => (
            <option key={booking.id} value={booking.id}>
              {booking.label}
            </option>
          ))}
          <option value="fictif">Des réponses fictives</option>
        </Select>
      </div>
      {source === "fictif" && used.length > 0 && (
        <div
          onChange={(event) => {
            const form = event.currentTarget.closest("form");
            if (!form) return;
            const data = new FormData(form);
            const now = new Date();
            const parse = (scope: EventTypeField["scope"]) =>
              parseFieldValues(
                used.filter((field) => field.scope === scope),
                rawFieldValues(data, `regle-test.${scope}.`),
                { now, enforceRequired: false },
              ).values;
            setFictive({
              event: {
                fieldValues: parse("event"),
                capacity: null,
                seatsHeld: 0,
                equipmentLeft: 0,
              },
              booking: {
                answers: parse("booking"),
                participants: [{ answers: parse("participant") }],
              },
            });
          }}
        >
          {(["event", "booking", "participant"] as const).map((scope) => (
            <FieldInputs
              key={scope}
              fields={used.filter((field) => field.scope === scope)}
              prefix={`regle-test.${scope}.`}
              enforceRequired={false}
              className="grid gap-3 sm:grid-cols-2"
            />
          ))}
        </div>
      )}
      {source === "fictif" && (
        <p className="text-[13px] leading-[18px] text-ink-muted">
          Réponses fictives : places, matériel et client restent inconnus (comptés comme « non »).
        </p>
      )}
      {error && <FieldError>{error}</FieldError>}
      {loading && <p className="text-sm text-ink-muted">Chargement de l'inscription…</p>}
      {facts && (
        <div className="flex flex-col gap-2">
          {rule.conditions.length > 0 && (
            <ul className="flex flex-col gap-1.5">
              {rule.conditions.map((group, groupIndex) =>
                group.map((condition, index) => {
                  const state = conditionHolds(condition, fields, facts);
                  const label =
                    STATE_LABELS[
                      state === undefined ? "unknown" : (String(state) as "true" | "false")
                    ];
                  return (
                    <li
                      // biome-ignore lint/suspicious/noArrayIndexKey: conditions sans identifiant, dans l'ordre.
                      key={`${groupIndex}-${index}`}
                      className="flex items-center gap-2 text-sm text-ink"
                    >
                      <span
                        className={cn(
                          "w-16 shrink-0 rounded-full py-0.5 text-center text-xs font-semibold",
                          label.className,
                        )}
                      >
                        {label.text}
                      </span>
                      {groupIndex > 0 && index === 0 ? "ou si " : index > 0 ? "et " : ""}
                      {describeCondition(condition, fields, context.pricing)}
                    </li>
                  );
                }),
              )}
            </ul>
          )}
          <p
            className={cn(
              "rounded-xl px-3.5 py-2.5 text-sm font-semibold leading-5",
              matched ? "bg-success-bg text-success" : "bg-surface text-ink-muted",
            )}
          >
            {matched
              ? `La règle s'appliquerait : ${listJoin(rule.actions.map(ruleActionDone))}.`
              : "La règle ne s'appliquerait pas : rien ne se passerait."}{" "}
            <span className="font-normal">Rien n'est exécuté.</span>
          </p>
        </div>
      )}
    </div>
  );
}

/* ---------- Fenêtre d'une règle (maquette 9.4) ---------- */

const emptyRule = (): Rule => ({
  id: `regle-${Date.now().toString(36)}`,
  name: "",
  trigger: { kind: "booking_submitted" },
  conditions: [],
  actions: [{ kind: "notify_team" }],
});

function RuleDialog({
  initial,
  position,
  total,
  others,
  context,
  onClose,
  onSave,
  onDelete,
}: {
  initial: Rule | null;
  position: number;
  total: number;
  others: Rule[];
  context: RuleEditorContext;
  onClose: () => void;
  onSave: (rule: Rule) => void;
  onDelete?: () => void;
}) {
  const [draft, setDraft] = useState<Rule>(() => structuredClone(initial ?? emptyRule()));
  const [error, setError] = useState<string | null>(null);
  const [testing, setTesting] = useState(false);
  const { fields } = context;
  const bookingKnown = BOOKING_TRIGGERS.has(draft.trigger.kind);
  const description = describeRule(draft, fields, context.pricing);
  const set = (patch: Partial<Rule>) => {
    setDraft((current) => ({ ...current, ...patch }));
    setError(null);
  };
  const setCondition = (groupIndex: number, index: number, next: RuleCondition | null) =>
    set({
      conditions: draft.conditions
        .map((group, g) =>
          g !== groupIndex
            ? group
            : next
              ? group.map((condition, c) => (c === index ? next : condition))
              : group.filter((_, c) => c !== index),
        )
        .filter((group) => group.length > 0),
    });
  const firstSubject = fields.find((field) => field.scope === "event" || bookingKnown);
  const newCondition = () =>
    conditionFor(firstSubject ? `field:${firstSubject.key}` : "seats:remaining", fields);

  const save = () => {
    // Clés des questions demandées : dérivées du libellé, libres parmi les champs et les règles.
    const taken = [
      ...fields.map((field) => field.key),
      ...others.flatMap((rule) =>
        rule.actions.flatMap((action) => (action.kind === "ask" ? [action.field.key] : [])),
      ),
    ];
    const actions = draft.actions.map((action) => {
      if (action.kind !== "ask" || action.field.key) return action;
      const key = keyFor(action.field.label, taken);
      taken.push(key);
      return { ...action, field: { ...action.field, key } };
    });
    const parsed = ruleSchema.safeParse({ ...draft, name: draft.name.trim(), actions });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Règle incomplète");
      return;
    }
    const issue = ruleIssues([parsed.data], fields, { pricing: context.pricing })[0];
    if (issue) {
      setError(issue.message.replace(/^« [^»]* » : /, ""));
      return;
    }
    onSave(parsed.data);
  };

  return (
    <Dialog
      open
      onClose={onClose}
      size="xl"
      density="compact"
      title={draft.name || "Nouvelle règle"}
      description={`${context.typeName || "Ce type"} · règle ${position} sur ${total}`}
      footer={
        <div className="flex w-full flex-col gap-2">
          {error && <FieldError>{error}</FieldError>}
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-between">
            {onDelete ? (
              <button
                type="button"
                onClick={onDelete}
                className="self-start text-[13px] font-semibold leading-[18px] text-danger hover:underline"
              >
                Supprimer la règle
              </button>
            ) : (
              <span />
            )}
            <div className="flex flex-wrap gap-2">
              <Button variant="secondary" size="sm" onClick={() => setTesting(!testing)}>
                {testing ? "Fermer le test" : "Tester sur une inscription"}
              </Button>
              <Button size="sm" onClick={save}>
                Enregistrer la règle
              </Button>
            </div>
          </div>
        </div>
      }
    >
      {/* Entrée dans un champ : pas d'envoi du formulaire du type. */}
      {/* biome-ignore lint/a11y/noStaticElementInteractions: on bloque seulement l'envoi par Entrée des champs. */}
      <div
        className="flex flex-col gap-4"
        onKeyDown={(event) => {
          if (event.key === "Enter" && event.target instanceof HTMLInputElement) {
            event.preventDefault();
          }
        }}
      >
        <Field label="Nom de la règle" required>
          {(props) => (
            <input
              {...props}
              value={draft.name}
              maxLength={80}
              placeholder="Autorisation des mineurs"
              onChange={(event) => set({ name: event.target.value })}
              className={inputClasses("sm")}
            />
          )}
        </Field>

        <p className="rounded-xl bg-warning-bg px-3.5 py-2.5 text-[15px] leading-[22px] text-warning-strong">
          {description.when},{" "}
          {description.condition && (
            <>
              <strong>si {description.condition}</strong>,{" "}
            </>
          )}
          <strong>{description.actions || "…"}</strong>.
        </p>

        <div className="flex flex-col gap-3">
          <BuilderRow label="Quand">
            <TriggerInput
              trigger={draft.trigger}
              onChange={(trigger) => {
                const allowed = ACTIONS_BY_TRIGGER[trigger.kind];
                const actions = draft.actions.filter((action) => allowed.includes(action.kind));
                set({
                  trigger,
                  actions: actions.length > 0 ? actions : [{ kind: "notify_team" }],
                });
              }}
            />
          </BuilderRow>

          <BuilderRow label="Si">
            {draft.conditions.length === 0 && (
              <p className="pt-2 text-[13px] text-ink-muted">Toujours (aucune condition).</p>
            )}
            {draft.conditions.map((group, groupIndex) =>
              group.map((condition, index) => (
                <ConditionRow
                  // biome-ignore lint/suspicious/noArrayIndexKey: conditions sans identifiant, dans l'ordre.
                  key={`${groupIndex}-${index}`}
                  prefix={index > 0 ? "et" : groupIndex > 0 ? "ou" : ""}
                  condition={condition}
                  fields={fields}
                  bookingKnown={bookingKnown}
                  pricing={context.pricing}
                  onChange={(next) => setCondition(groupIndex, index, next)}
                  onRemove={() => setCondition(groupIndex, index, null)}
                />
              )),
            )}
            <div className="flex items-center gap-3 pl-[26px]">
              <button
                type="button"
                className="text-[13px] font-semibold leading-[18px] text-link hover:underline"
                onClick={() =>
                  set({
                    conditions:
                      draft.conditions.length === 0
                        ? [[newCondition()]]
                        : draft.conditions.map((group, index) =>
                            index === draft.conditions.length - 1
                              ? [...group, newCondition()]
                              : group,
                          ),
                  })
                }
              >
                + Et
              </button>
              <button
                type="button"
                className="text-[13px] font-semibold leading-[18px] text-link hover:underline"
                onClick={() => set({ conditions: [...draft.conditions, [newCondition()]] })}
              >
                + Ou
              </button>
            </div>
          </BuilderRow>

          <BuilderRow label="Alors">
            {draft.actions.map((action, index) => (
              <ActionRow
                // biome-ignore lint/suspicious/noArrayIndexKey: actions sans identifiant, dans l'ordre.
                key={index}
                action={action}
                trigger={draft.trigger}
                documents={context.documents}
                pricing={context.pricing}
                onChange={(next) =>
                  set({ actions: draft.actions.map((entry, i) => (i === index ? next : entry)) })
                }
                onRemove={() => set({ actions: draft.actions.filter((_, i) => i !== index) })}
              />
            ))}
            {draft.actions.length < 6 && (
              <button
                type="button"
                className="self-start text-[13px] font-semibold leading-[18px] text-link hover:underline"
                onClick={() =>
                  set({
                    actions: [
                      ...draft.actions,
                      actionFor(ACTIONS_BY_TRIGGER[draft.trigger.kind][0] ?? "notify_team"),
                    ],
                  })
                }
              >
                + Ajouter une action
              </button>
            )}
          </BuilderRow>
        </div>

        <Collapse open={testing}>{testing && <RuleTest rule={draft} context={context} />}</Collapse>

        <Possibilities />
      </div>
    </Dialog>
  );
}
