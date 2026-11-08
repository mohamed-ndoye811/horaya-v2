import {
  type FieldDefinition,
  type FieldValue,
  type FieldValues,
  isFieldShown,
  parseFieldValues,
} from "@horaya/core";
import { useState } from "react";
import { Checkbox, Field, inputClasses, textareaClasses } from "@/components/ui/field";
import { Select } from "@/components/ui/select";
import { cn } from "@/lib/cn";
import { rawFieldValues } from "@/lib/fields";

/** Valeur enregistrée → valeur par défaut d'un champ de formulaire. */
const asText = (value: FieldValue | undefined) =>
  value === undefined || Array.isArray(value) || typeof value === "boolean" ? "" : String(value);

/** Oui / non en deux pastilles (radio), comme la maquette 9.1. */
function YesNo({
  name,
  defaultValue,
  labelledBy,
}: {
  name: string;
  defaultValue: FieldValue | undefined;
  labelledBy: string;
}) {
  return (
    <div role="radiogroup" aria-labelledby={labelledBy} className="flex gap-1.5">
      {[
        { value: "true", label: "Oui" },
        { value: "false", label: "Non" },
      ].map((option) => (
        <label
          key={option.value}
          className={cn(
            "flex h-9 items-center rounded-full bg-field px-4 text-sm font-semibold text-ink hover:bg-line-soft",
            "has-checked:bg-ink has-checked:text-on-ink has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-ink",
          )}
        >
          <input
            type="radio"
            name={name}
            value={option.value}
            defaultChecked={defaultValue === (option.value === "true")}
            className="sr-only"
          />
          {option.label}
        </label>
      ))}
    </div>
  );
}

/** Un champ généré d'après sa définition. */
export function FieldInput({
  field,
  name,
  defaultValue,
  error,
  enforceRequired = true,
}: {
  field: FieldDefinition;
  name: string;
  defaultValue?: FieldValue;
  error?: string;
  /** Faux pour l'équipe : la case « requis » reste indicative. */
  enforceRequired?: boolean;
}) {
  const required = field.required && enforceRequired;
  const hint = field.help ? (
    <p className="text-[13px] font-medium leading-[18px] text-ink-muted">{field.help}</p>
  ) : undefined;

  if (field.type === "acceptance") {
    return (
      <div className="flex flex-col gap-1.5">
        <Checkbox
          name={name}
          required={required}
          defaultChecked={typeof defaultValue === "string"}
          label={field.label}
          aria-invalid={error ? true : undefined}
        />
        {error ? <p className="text-[13px] font-semibold text-danger">{error}</p> : hint}
      </div>
    );
  }

  return (
    <Field
      label={field.label}
      required={field.required}
      error={error}
      hint={hint}
      group={field.type === "boolean" || field.type === "multi_choice"}
    >
      {(props) => {
        switch (field.type) {
          case "long_text":
            return (
              <textarea
                {...props}
                name={name}
                rows={3}
                maxLength={5000}
                required={required}
                defaultValue={asText(defaultValue)}
                className={textareaClasses()}
              />
            );
          case "boolean":
            return <YesNo name={name} defaultValue={defaultValue} labelledBy={props.id} />;
          case "choice":
            return (
              <Select
                {...props}
                name={name}
                required={required}
                defaultValue={asText(defaultValue)}
              >
                <option value="">Choisis…</option>
                {(field.options ?? []).map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </Select>
            );
          case "multi_choice":
            return (
              <div id={props.id} className="flex flex-wrap gap-x-5 gap-y-2.5">
                {(field.options ?? []).map((option) => (
                  <Checkbox
                    key={option}
                    name={name}
                    value={option}
                    defaultChecked={Array.isArray(defaultValue) && defaultValue.includes(option)}
                    label={option}
                  />
                ))}
              </div>
            );
          default:
            return (
              <input
                {...props}
                name={name}
                type={field.type === "date" ? "date" : field.type === "url" ? "url" : "text"}
                inputMode={field.type === "number" ? "decimal" : undefined}
                maxLength={field.type === "short_text" ? 500 : undefined}
                required={required}
                defaultValue={asText(defaultValue)}
                placeholder={field.type === "url" ? "https://" : undefined}
                className={inputClasses()}
              />
            );
        }
      }}
    </Field>
  );
}

/**
 * Champs générés d'un bloc (« Ce que tu décris », questions d'une inscription, un participant).
 * Les conditions d'affichage suivent la saisie ; le serveur les revérifie.
 * Noms : `${prefix}${clé}` ; erreurs lues sous `${errorPrefix}${clé}`.
 */
export function FieldInputs({
  fields,
  prefix,
  errorPrefix = prefix,
  defaults = {},
  errors = {},
  enforceRequired = true,
  className = "grid gap-4 sm:grid-cols-2",
}: {
  fields: FieldDefinition[];
  prefix: string;
  errorPrefix?: string;
  defaults?: FieldValues;
  errors?: Record<string, string>;
  enforceRequired?: boolean;
  className?: string;
}) {
  const [values, setValues] = useState<FieldValues>(defaults);
  if (fields.length === 0) return null;
  const shown: FieldDefinition[] = [];
  for (const field of fields) if (isFieldShown(field, values)) shown.push(field);
  return (
    <div
      className={className}
      onChange={(event) => {
        const form = event.currentTarget.closest("form");
        if (!form) return;
        const raw = rawFieldValues(new FormData(form), prefix);
        setValues(
          parseFieldValues(fields, raw, { now: new Date(), enforceRequired: false }).values,
        );
      }}
    >
      {shown.map((field) => (
        <div
          key={field.key}
          className={
            field.type === "long_text" ||
            field.type === "acceptance" ||
            field.type === "multi_choice"
              ? "sm:col-span-2"
              : undefined
          }
        >
          <FieldInput
            field={field}
            name={`${prefix}${field.key}`}
            defaultValue={defaults[field.key]}
            error={errors[`${errorPrefix}${field.key}`]}
            enforceRequired={enforceRequired}
          />
        </div>
      ))}
    </div>
  );
}
