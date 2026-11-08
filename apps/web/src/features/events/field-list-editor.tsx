import {
  CONDITION_FIELD_TYPES,
  type EventTypeField,
  FIELD_TYPES,
  type FieldScope,
  type FieldType,
} from "@horaya/core";
import { type ReactNode, useState } from "react";
import { Collapse } from "@/components/motion/collapse";
import { PresenceItem, PresenceList } from "@/components/motion/presence";
import { Button, textLinkClasses } from "@/components/ui/button";
import { Checkbox, Field, FieldError, inputClasses } from "@/components/ui/field";
import { PlusIcon } from "@/components/ui/icons";
import { Select } from "@/components/ui/select";
import { Tag } from "@/components/ui/tag";
import { cn } from "@/lib/cn";
import { FIELD_TYPE_LABELS } from "@/lib/fields";

/**
 * Champ en cours d'édition. Les champs du matériel n'ont pas de portée : `scope` absent.
 */
export type EditableField = Omit<EventTypeField, "scope"> & { scope?: FieldScope };

/** « Régime alimentaire » → « regime_alimentaire » (clé stable des réponses). */
export function keyFor(label: string, taken: string[]): string {
  const base =
    label
      .normalize("NFD")
      .replace(/\p{Diacritic}/gu, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "")
      .replace(/^(\d)/, "c_$1")
      .slice(0, 36) || "champ";
  let key = base;
  for (let index = 2; taken.includes(key); index++) key = `${base}_${index}`;
  return key;
}

const choices = (type: FieldType) => type === "choice" || type === "multi_choice";

/** Libellé court d'une condition (« Si « oui » », « Si « Débutant » »). */
function conditionLabel(field: EditableField, all: EditableField[]): string | null {
  if (!field.condition) return null;
  const target = all.find((other) => other.key === field.condition?.fieldKey);
  const value = field.condition.equals;
  return `Si « ${typeof value === "boolean" ? (value ? "oui" : "non") : value} »${target ? "" : " ?"}`;
}

/** Ligne d'un champ (maquette 9.1) : type, libellé, détail, pastilles. */
function FieldRow({
  field,
  all,
  onEdit,
}: {
  field: EditableField;
  all: EditableField[];
  onEdit: () => void;
}) {
  const detail = choices(field.type) ? field.options?.join(" · ") : field.help;
  const condition = conditionLabel(field, all);
  const row = (
    <button
      type="button"
      onClick={onEdit}
      aria-label={`Modifier « ${field.label} »`}
      className="flex min-h-12 w-full grow items-center gap-3 rounded-xl bg-field px-3 py-2 text-left press hover:bg-line-soft"
    >
      <span className="hidden w-[110px] shrink-0 sm:block">
        <span className="inline-flex rounded-md bg-surface px-2 py-[3px] text-label font-semibold leading-4 text-ink-muted">
          {FIELD_TYPE_LABELS[field.type]}
        </span>
      </span>
      <span className="min-w-0 grow text-sm font-semibold leading-[18px] text-ink">
        {field.label}
      </span>
      {detail && (
        <span className="hidden min-w-0 truncate text-[13px] leading-4 text-ink-muted md:block md:max-w-[40%]">
          {detail}
        </span>
      )}
      <span className="flex shrink-0 flex-wrap justify-end gap-1.5 sm:w-[150px]">
        {condition && <Tag tone="warning">{condition}</Tag>}
        {field.publicFilter && <Tag tone="info">Filtre public</Tag>}
        {field.visibility === "internal" && <Tag tone="draft">Interne</Tag>}
        {field.required && !condition && <Tag tone="surface">Requis</Tag>}
      </span>
    </button>
  );
  if (!field.condition) return row;
  // Champ conditionnel : en retrait, sous le champ dont il dépend.
  return (
    <div className="flex items-center gap-3 pl-7">
      <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true" className="shrink-0">
        <path
          d="M4 4v8a4 4 0 0 0 4 4h12M16 12l4 4-4 4"
          fill="none"
          stroke="var(--color-ink-faint)"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      {row}
    </div>
  );
}

/** Formulaire d'un champ, dans la liste (nouveau ou modifié). */
function FieldEditor({
  initial,
  previous,
  types,
  describes,
  error,
  onSave,
  onCancel,
  onRemove,
  onMove,
}: {
  initial: EditableField;
  /** Champs placés avant celui-ci (cibles possibles d'une condition). */
  previous: EditableField[];
  types: readonly FieldType[];
  /** « Ce que tu décris » : visibilité et filtre public. */
  describes: boolean;
  error: string | null;
  onSave: (field: EditableField) => void;
  onCancel: () => void;
  onRemove?: () => void;
  onMove?: (offset: -1 | 1) => void;
}) {
  const [draft, setDraft] = useState(initial);
  const [options, setOptions] = useState((initial.options ?? []).join("\n"));
  const targets = previous.filter((field) => CONDITION_FIELD_TYPES.includes(field.type));
  const target = targets.find((field) => field.key === draft.condition?.fieldKey);
  const set = (patch: Partial<EditableField>) => setDraft((current) => ({ ...current, ...patch }));

  function save() {
    const list = options
      .split(/\n|,/)
      .map((option) => option.trim())
      .filter(Boolean);
    const { options: _options, publicFilter, visibility, ...rest } = draft;
    onSave({
      ...rest,
      ...(choices(draft.type) ? { options: list } : {}),
      ...(describes && visibility === "internal" ? { visibility } : {}),
      ...(describes && choices(draft.type) && publicFilter ? { publicFilter } : {}),
    });
  }

  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: Entrée dans un champ valide ce champ, pas tout le formulaire.
    <div
      onKeyDown={(event) => {
        if (event.key === "Enter" && event.target instanceof HTMLInputElement) {
          event.preventDefault();
          if (draft.label.trim()) save();
        }
      }}
      className="flex animate-fade flex-col gap-4 rounded-2xl bg-surface p-4 outline-[1.5px] -outline-offset-[1.5px] outline-ink"
    >
      <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_180px]">
        <Field label={draft.type === "acceptance" ? "Texte à accepter" : "Libellé"} required>
          {(props) => (
            <input
              {...props}
              value={draft.label}
              onChange={(event) => set({ label: event.target.value })}
              maxLength={200}
              placeholder={describes ? "Ex. Niveau" : "Ex. Régime alimentaire"}
              className={inputClasses("sm")}
            />
          )}
        </Field>
        <Field label="Type">
          {(props) => (
            <Select
              {...props}
              variant="compact"
              value={draft.type}
              onChange={(event) =>
                set({ type: event.target.value as FieldType, publicFilter: undefined })
              }
            >
              {types.map((type) => (
                <option key={type} value={type}>
                  {FIELD_TYPE_LABELS[type]}
                </option>
              ))}
            </Select>
          )}
        </Field>
      </div>
      <Collapse open={choices(draft.type)}>
        <Field label="Choix possibles" hint={<Hint>Un choix par ligne.</Hint>}>
          {(props) => (
            <textarea
              {...props}
              value={options}
              onChange={(event) => setOptions(event.target.value)}
              rows={3}
              placeholder={"Débutant\nIntermédiaire\nConfirmé"}
              className={cn(inputClasses("sm"), "h-auto py-2.5")}
            />
          )}
        </Field>
      </Collapse>
      <Field label="Aide" hint={<Hint>Affichée sous le champ (facultatif).</Hint>}>
        {(props) => (
          <input
            {...props}
            value={draft.help ?? ""}
            onChange={(event) => set({ help: event.target.value || undefined })}
            maxLength={300}
            className={inputClasses("sm")}
          />
        )}
      </Field>
      {targets.length > 0 && (
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Afficher seulement si">
            {(props) => (
              <Select
                {...props}
                variant="compact"
                value={draft.condition?.fieldKey ?? ""}
                onChange={(event) => {
                  const next = targets.find((field) => field.key === event.target.value);
                  set({
                    condition: next
                      ? {
                          fieldKey: next.key,
                          equals: next.type === "boolean" ? true : (next.options?.[0] ?? ""),
                        }
                      : undefined,
                  });
                }}
              >
                <option value="">Toujours affiché</option>
                {targets.map((field) => (
                  <option key={field.key} value={field.key}>
                    {field.label}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          {target && draft.condition && (
            <Field label={target.type === "multi_choice" ? "contient" : "vaut"}>
              {(props) => (
                <Select
                  {...props}
                  variant="compact"
                  value={String(draft.condition?.equals)}
                  onChange={(event) =>
                    set({
                      condition: {
                        fieldKey: target.key,
                        equals:
                          target.type === "boolean"
                            ? event.target.value === "true"
                            : event.target.value,
                      },
                    })
                  }
                >
                  {(target.type === "boolean" ? ["true", "false"] : (target.options ?? [])).map(
                    (value) => (
                      <option key={value} value={value}>
                        {value === "true" ? "Oui" : value === "false" ? "Non" : value}
                      </option>
                    ),
                  )}
                </Select>
              )}
            </Field>
          )}
        </div>
      )}
      <div className="flex flex-wrap gap-x-6 gap-y-3">
        <Checkbox
          checked={draft.required}
          onChange={(event) => set({ required: event.target.checked })}
          label={describes ? "À remplir sur chaque événement" : "Réponse requise"}
        />
        {describes && (
          <Checkbox
            checked={draft.visibility === "internal"}
            onChange={(event) => set({ visibility: event.target.checked ? "internal" : undefined })}
            label="Interne (pas sur la page publique)"
          />
        )}
        {describes && choices(draft.type) && (
          <Checkbox
            checked={draft.publicFilter ?? false}
            onChange={(event) => set({ publicFilter: event.target.checked || undefined })}
            label="Filtre sur la page publique"
          />
        )}
      </div>
      {error && <FieldError>{error}</FieldError>}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-4">
          {onRemove && (
            <button
              type="button"
              onClick={onRemove}
              className="tap-area text-sm font-semibold text-danger hover:underline"
            >
              Retirer
            </button>
          )}
          {onMove && (
            <>
              <button type="button" onClick={() => onMove(-1)} className={textLinkClasses}>
                Monter
              </button>
              <button type="button" onClick={() => onMove(1)} className={textLinkClasses}>
                Descendre
              </button>
            </>
          )}
        </div>
        <div className="flex gap-2">
          <Button variant="soft" size="xs" onClick={onCancel}>
            Annuler
          </Button>
          <Button variant="primary" size="xs" onClick={save} disabled={!draft.label.trim()}>
            Valider
          </Button>
        </div>
      </div>
    </div>
  );
}

function Hint({ children }: { children: ReactNode }) {
  return <p className="text-[13px] font-medium leading-[18px] text-ink-muted">{children}</p>;
}

/**
 * Liste des champs d'une portée, modifiable sur place. `onChange` reçoit la nouvelle liste et
 * renvoie une erreur (validée par le schéma du core) ou null si elle est acceptée.
 */
export function FieldListEditor({
  fields,
  scope,
  all,
  onChange,
  addLabel,
  addHint,
  types = FIELD_TYPES,
  describes = false,
}: {
  /** Champs de cette portée, dans l'ordre. */
  fields: EditableField[];
  scope: FieldScope | undefined;
  /** Tous les champs (clés déjà prises). */
  all: EditableField[];
  onChange: (fields: EditableField[]) => string | null;
  addLabel: string;
  addHint: string;
  types?: readonly FieldType[];
  describes?: boolean;
}) {
  // Champ ouvert : son index, ou « new » pour un ajout.
  const [open, setOpen] = useState<number | "new" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const close = () => {
    setOpen(null);
    setError(null);
  };
  const commit = (next: EditableField[]) => {
    const problem = onChange(next);
    if (problem) setError(problem);
    else close();
  };

  return (
    <div className="relative flex flex-col gap-2">
      <PresenceList>
        {fields.map((field, index) => (
          <PresenceItem key={field.key}>
            {open === index ? (
              <FieldEditor
                initial={field}
                previous={fields.slice(0, index)}
                types={types}
                describes={describes}
                error={error}
                onCancel={close}
                onSave={(saved) =>
                  commit(fields.map((entry, at) => (at === index ? saved : entry)))
                }
                onRemove={() =>
                  commit(
                    fields
                      .filter((_, at) => at !== index)
                      // Les champs qui en dépendaient redeviennent toujours affichés.
                      .map((entry) =>
                        entry.condition?.fieldKey === field.key
                          ? { ...entry, condition: undefined }
                          : entry,
                      ),
                  )
                }
                onMove={(offset) => {
                  const target = index + offset;
                  if (target < 0 || target >= fields.length) return;
                  const next = [...fields];
                  [next[index], next[target]] = [next[target] as EditableField, field];
                  const problem = onChange(next);
                  if (problem) setError(problem);
                  else {
                    setError(null);
                    setOpen(target);
                  }
                }}
              />
            ) : (
              <FieldRow
                field={field}
                all={fields}
                onEdit={() => {
                  setError(null);
                  setOpen(index);
                }}
              />
            )}
          </PresenceItem>
        ))}
        {open === "new" ? (
          <PresenceItem key="new">
            <FieldEditor
              initial={{
                key: "",
                label: "",
                type: types[0] ?? "short_text",
                required: false,
                ...(scope ? { scope } : {}),
              }}
              previous={fields}
              types={types}
              describes={describes}
              error={error}
              onCancel={close}
              onSave={(saved) =>
                commit([
                  ...fields,
                  {
                    ...saved,
                    key: keyFor(
                      saved.label,
                      all.map((field) => field.key),
                    ),
                  },
                ])
              }
            />
          </PresenceItem>
        ) : (
          <PresenceItem key="add">
            <button
              type="button"
              onClick={() => {
                setError(null);
                setOpen("new");
              }}
              className="flex flex-wrap items-center gap-x-2.5 gap-y-0.5 pt-2.5 text-left"
            >
              <span className={cn(textLinkClasses, "flex items-center gap-2 text-sm")}>
                <PlusIcon size={10} />
                {addLabel}
              </span>
              <span className="text-[13px] leading-[17px] text-ink-subtle">{addHint}</span>
            </button>
          </PresenceItem>
        )}
      </PresenceList>
    </div>
  );
}
