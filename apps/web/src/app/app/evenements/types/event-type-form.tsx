"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { Button, textLinkClasses } from "@/components/ui/button";
import { AffixInput, Checkbox, Field, inputClasses } from "@/components/ui/field";
import { FormAlert } from "@/components/ui/form-alert";
import { CloseIcon, PlusIcon } from "@/components/ui/icons";
import { Select } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/cn";
import { centsToInput } from "@/lib/money";
import { useFormAction } from "@/lib/use-form-action";
import type { FormState } from "@/server/form-state";
import { archiveEventTypeAction, saveEventType } from "../actions";

export const TYPE_COLORS = [
  "#528D74",
  "#D8BC66",
  "#CF879C",
  "#66537C",
  "#264489",
  "#3165B8",
  "#A9663F",
];

type FieldType = "text" | "select" | "checkbox";
interface CustomField {
  key: string;
  label: string;
  type: FieldType;
  required: boolean;
  options?: string[];
}

const FIELD_TYPE_LABELS: Record<FieldType, string> = {
  text: "Texte",
  select: "Choix",
  checkbox: "Case à cocher",
};

/** « Régime alimentaire » → « regime_alimentaire » (clé stable des réponses). */
function keyFor(label: string, taken: string[]): string {
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

export interface EventTypeFormValues {
  id: string | null;
  name: string;
  color: string;
  defaultDurationMinutes: number | null;
  defaultPriceCents: number | null;
  defaultCapacity: number | null;
  requiresApproval: boolean;
  customFields: CustomField[];
  bookingRules: { minAdvanceHours?: number; waitlistEnabled?: boolean };
  eventCount: number;
}

/** Panneau « Modifier le type » de l'écran 16. */
export function EventTypeForm({ initial }: { initial: EventTypeFormValues }) {
  const { state, onSubmit, pending } = useFormAction<FormState>(
    saveEventType.bind(null, initial.id),
    {},
  );
  const [color, setColor] = useState(initial.color);
  const [fields, setFields] = useState<CustomField[]>(initial.customFields);
  const [draftLabel, setDraftLabel] = useState("");
  const [draftType, setDraftType] = useState<FieldType>("text");
  const [draftRequired, setDraftRequired] = useState(false);
  const [draftOptions, setDraftOptions] = useState("");
  const [archiving, startArchive] = useTransition();
  const [archiveError, setArchiveError] = useState<string | null>(null);
  const errors = state.fieldErrors ?? {};

  function addField() {
    const label = draftLabel.trim();
    if (!label) return;
    const options = draftOptions
      .split(",")
      .map((option) => option.trim())
      .filter(Boolean);
    setFields((current) => [
      ...current,
      {
        key: keyFor(
          label,
          current.map((field) => field.key),
        ),
        label,
        type: draftType,
        required: draftRequired,
        ...(draftType === "select" ? { options } : {}),
      },
    ]);
    setDraftLabel("");
    setDraftOptions("");
    setDraftRequired(false);
  }

  return (
    <form onSubmit={onSubmit} className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b-2 border-ink px-6 py-5">
        <h2 className="font-section text-section leading-7 text-ink">
          {initial.id ? "Modifier le type" : "Nouveau type"}
        </h2>
        <Link
          href="/app/evenements/types"
          aria-label="Fermer"
          className="flex size-9 items-center justify-center text-ink hover:bg-draft-bg"
        >
          <CloseIcon />
        </Link>
      </div>

      <div className="flex flex-1 flex-col overflow-y-auto">
        <div className="flex flex-col gap-5 border-b border-line-soft px-6 py-6">
          {state.error && <FormAlert>{state.error}</FormAlert>}
          <Field label="Nom" required error={errors.name}>
            {(field) => (
              <input
                {...field}
                name="name"
                required
                maxLength={60}
                defaultValue={initial.name}
                placeholder="Séminaire"
                className={inputClasses()}
              />
            )}
          </Field>
          <fieldset className="flex flex-col gap-2">
            <legend className="mb-2 text-sm font-bold text-ink">Couleur</legend>
            <input type="hidden" name="color" value={color} />
            <div className="flex flex-wrap gap-2">
              {TYPE_COLORS.map((swatch) => (
                <button
                  key={swatch}
                  type="button"
                  onClick={() => setColor(swatch)}
                  aria-label={`Couleur ${swatch}`}
                  aria-pressed={color === swatch}
                  className={cn(
                    "size-9 border-2 p-0.5",
                    color === swatch ? "border-ink" : "border-transparent",
                  )}
                >
                  <span className="block size-full" style={{ backgroundColor: swatch }} />
                </button>
              ))}
            </div>
          </fieldset>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Durée par défaut">
              {(field) => (
                <Select
                  {...field}
                  name="defaultDuration"
                  defaultValue={
                    initial.defaultDurationMinutes ? String(initial.defaultDurationMinutes) : ""
                  }
                >
                  <option value="">—</option>
                  <option value="30">30 min</option>
                  <option value="60">1 h</option>
                  <option value="90">1 h 30</option>
                  <option value="120">2 h</option>
                  <option value="150">2 h 30</option>
                  <option value="180">3 h</option>
                  <option value="240">4 h</option>
                  <option value="1440">1 jour</option>
                </Select>
              )}
            </Field>
            <Field label="Prix par défaut" error={errors.defaultPriceCents}>
              {(field) => (
                <AffixInput
                  {...field}
                  name="defaultPrice"
                  inputMode="decimal"
                  defaultValue={
                    initial.defaultPriceCents ? centsToInput(initial.defaultPriceCents) : ""
                  }
                  placeholder="Gratuit"
                  suffix="€"
                  mono
                />
              )}
            </Field>
          </div>
          <Field label="Places par défaut" error={errors.defaultCapacity}>
            {(field) => (
              <AffixInput
                {...field}
                name="defaultCapacity"
                inputMode="numeric"
                defaultValue={initial.defaultCapacity ?? ""}
                placeholder="Illimité"
                suffix="places"
                mono
              />
            )}
          </Field>
        </div>

        <div className="flex flex-col gap-3 border-b border-line-soft px-6 py-6">
          <p className="font-mono text-label font-semibold uppercase tracking-[0.055em] text-neutral">
            Champs demandés à la réservation
          </p>
          <input type="hidden" name="customFields" value={JSON.stringify(fields)} />
          {fields.length === 0 && (
            <p className="text-sm font-medium text-ink-muted">
              Seuls le nom, l'e-mail et le téléphone sont demandés.
            </p>
          )}
          <ul className="flex flex-col gap-2">
            {fields.map((field) => (
              <li
                key={field.key}
                className="flex items-center justify-between gap-3 border-[1.5px] border-ink-subtle bg-surface px-3.5 py-2.5"
              >
                <span className="min-w-0 truncate text-sm font-semibold text-ink">
                  {field.label}
                </span>
                <span className="flex shrink-0 items-center gap-3">
                  <span className="font-mono text-[11px] font-semibold uppercase tracking-[0.045em] text-ink-muted">
                    {FIELD_TYPE_LABELS[field.type]}
                    {field.required ? " · requis" : ""}
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      setFields((current) => current.filter((entry) => entry.key !== field.key))
                    }
                    aria-label={`Retirer le champ ${field.label}`}
                    className="flex size-7 items-center justify-center text-ink hover:bg-draft-bg"
                  >
                    <CloseIcon size={10} />
                  </button>
                </span>
              </li>
            ))}
          </ul>
          <div className="flex flex-col gap-2.5 border-[1.5px] border-dashed border-ink-subtle p-3">
            <div className="flex gap-2">
              <input
                value={draftLabel}
                onChange={(event) => setDraftLabel(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    addField();
                  }
                }}
                aria-label="Libellé du champ"
                placeholder="Ex. Régime alimentaire"
                className={cn(inputClasses(), "h-10 text-sm")}
              />
              <Select
                variant="compact"
                aria-label="Type de champ"
                value={draftType}
                onChange={(event) => setDraftType(event.target.value as FieldType)}
                className="w-40 shrink-0"
              >
                <option value="text">Texte</option>
                <option value="select">Choix</option>
                <option value="checkbox">Case à cocher</option>
              </Select>
            </div>
            {draftType === "select" && (
              <input
                value={draftOptions}
                onChange={(event) => setDraftOptions(event.target.value)}
                aria-label="Choix possibles"
                placeholder="Choix séparés par des virgules : Végétarien, Sans gluten…"
                className={cn(inputClasses(), "h-10 text-sm")}
              />
            )}
            <div className="flex items-center justify-between gap-3">
              <Checkbox
                checked={draftRequired}
                onChange={(event) => setDraftRequired(event.target.checked)}
                label="Requis"
              />
              <button
                type="button"
                onClick={addField}
                className={cn(textLinkClasses, "flex items-center gap-1.5 text-sm")}
              >
                <PlusIcon size={10} />
                Ajouter le champ
              </button>
            </div>
          </div>
          {errors.customFields && (
            <p className="text-[13px] font-semibold text-danger">{errors.customFields}</p>
          )}
        </div>

        <div className="flex flex-col gap-4 px-6 py-6">
          <p className="font-mono text-label font-semibold uppercase tracking-[0.055em] text-neutral">
            Règles de réservation
          </p>
          <Switch
            name="requiresApproval"
            defaultChecked={initial.requiresApproval}
            label="Valider chaque réservation manuellement"
          />
          <Switch
            name="waitlistEnabled"
            defaultChecked={initial.bookingRules.waitlistEnabled ?? false}
            label="Liste d'attente quand c'est complet"
          />
          <div className="flex items-center justify-between gap-3">
            <label htmlFor="type-min-advance" className="text-[15px] font-bold text-ink">
              Réservation en ligne jusqu'à
            </label>
            <Select
              id="type-min-advance"
              variant="compact"
              name="minAdvanceHours"
              defaultValue={
                initial.bookingRules.minAdvanceHours !== undefined
                  ? String(initial.bookingRules.minAdvanceHours)
                  : ""
              }
              className="w-36"
            >
              <option value="">Le début</option>
              <option value="2">2 h avant</option>
              <option value="24">J-1</option>
              <option value="48">J-2</option>
              <option value="72">J-3</option>
              <option value="168">J-7</option>
            </Select>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 border-t-2 border-ink px-6 py-5">
        {initial.id ? (
          <button
            type="button"
            disabled={archiving}
            onClick={() =>
              startArchive(async () => {
                const result = await archiveEventTypeAction(initial.id ?? "");
                if (result?.error) setArchiveError(result.error);
              })
            }
            className="text-sm font-bold text-danger underline decoration-1 underline-offset-[3px] hover:text-danger/80"
            title={initial.eventCount > 0 ? "Les événements existants gardent ce type" : undefined}
          >
            {archiving ? "Suppression…" : "Supprimer le type"}
          </button>
        ) : (
          <span />
        )}
        <Button type="submit" pending={pending}>
          {initial.id ? "Enregistrer" : "Créer le type"}
        </Button>
        {archiveError && (
          <p className="w-full text-[13px] font-semibold text-danger">{archiveError}</p>
        )}
      </div>
    </form>
  );
}
