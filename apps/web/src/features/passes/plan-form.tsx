import { isRedirect, useRouter } from "@tanstack/react-router";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { AffixInput, Checkbox, Field, inputClasses } from "@/components/ui/field";
import { FormAlert } from "@/components/ui/form-alert";
import { CloseIcon } from "@/components/ui/icons";
import { archivePassPlanAction, savePassPlan } from "@/functions/passes";
import { centsToInput } from "@/lib/money";
import { Link } from "@/lib/navigation";
import { useFormAction } from "@/lib/use-form-action";
import type { FormState } from "@/server/form-state";

export interface PlanFormValues {
  id: string | null;
  name: string;
  sessions: number;
  priceCents: number;
  validityDays: number;
  eventTypeIds: string[];
  archived: boolean;
}

/** Panneau « Formule de carte » : nom, séances, prix, validité, types acceptés. */
export function PlanForm({
  initial,
  eventTypes,
}: {
  initial: PlanFormValues;
  eventTypes: Array<{ id: string; name: string }>;
}) {
  const { state, onSubmit, pending } = useFormAction<FormState>(
    savePassPlan.bind(null, initial.id),
    {},
  );
  const router = useRouter();
  const [archiving, setArchiving] = useState(false);
  const [archiveError, setArchiveError] = useState<string | null>(null);
  const errors = state.fieldErrors ?? {};

  async function toggleArchive() {
    if (!initial.id) return;
    setArchiving(true);
    try {
      const result = await archivePassPlanAction(initial.id, !initial.archived);
      if (result?.error) setArchiveError(result.error);
    } catch (error) {
      // Le serveur renvoie vers la liste (redirection levée).
      if (!isRedirect(error)) throw error;
      await router.navigate(error.options);
    } finally {
      setArchiving(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col">
      <div className="flex items-center justify-between px-6 pt-6 pb-2">
        <h2 className="font-headline text-subtitle text-ink">
          {initial.id ? initial.name || "Modifier la formule" : "Nouvelle formule"}
        </h2>
        <Link
          href="/app/cartes"
          aria-label="Fermer"
          className="flex size-9 items-center justify-center rounded-full bg-field text-ink hover:bg-line-soft"
        >
          <CloseIcon />
        </Link>
      </div>
      <div className="flex flex-col gap-5 px-6 pt-4 pb-6">
        {state.error && !state.fieldErrors && <FormAlert>{state.error}</FormAlert>}
        <Field label="Nom" required error={errors.name}>
          {(field) => (
            <input
              {...field}
              name="name"
              required
              maxLength={80}
              defaultValue={initial.name}
              placeholder="Carte 10 séances"
              className={inputClasses()}
            />
          )}
        </Field>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Séances" required error={errors.sessions}>
            {(field) => (
              <AffixInput
                {...field}
                name="sessions"
                inputMode="numeric"
                required
                defaultValue={initial.sessions || ""}
                placeholder="10"
                suffix="séances"
              />
            )}
          </Field>
          <Field label="Prix" required error={errors.priceCents}>
            {(field) => (
              <AffixInput
                {...field}
                name="price"
                inputMode="decimal"
                required
                defaultValue={initial.id ? centsToInput(initial.priceCents) : ""}
                placeholder="120,00"
                suffix="€"
              />
            )}
          </Field>
        </div>
        <Field label="Durée de validité" required error={errors.validityDays}>
          {(field) => (
            <AffixInput
              {...field}
              name="validityDays"
              inputMode="numeric"
              required
              defaultValue={initial.validityDays || ""}
              placeholder="180"
              suffix="jours"
            />
          )}
        </Field>
        <fieldset className="flex flex-col gap-2.5">
          <legend className="mb-1 text-meta font-semibold text-ink">
            Types d'événements acceptés
          </legend>
          <p className="text-meta text-ink-subtle">Aucun coché : la carte vaut pour tous.</p>
          {eventTypes.map((type) => (
            <Checkbox
              key={type.id}
              name="eventTypeIds"
              value={type.id}
              defaultChecked={initial.eventTypeIds.includes(type.id)}
              label={type.name}
            />
          ))}
        </fieldset>
        <p className="text-meta text-ink-subtle">
          Les cartes déjà vendues gardent les conditions du jour de la vente.
        </p>
      </div>
      <div className="mx-6 mb-6 flex flex-wrap items-center justify-between gap-3 rounded-full bg-ink py-2 pr-2 pl-5">
        {initial.id ? (
          <button
            type="button"
            disabled={archiving}
            onClick={toggleArchive}
            className="tap-area text-sm font-semibold text-danger-on-ink hover:underline"
          >
            {initial.archived ? "Remettre en vente" : "Archiver la formule"}
          </button>
        ) : (
          <span />
        )}
        <Button type="submit" variant="inverse" pending={pending}>
          {initial.id ? "Enregistrer" : "Créer la formule"}
        </Button>
        {archiveError && (
          <p className="w-full animate-drop pb-2 text-meta font-semibold text-danger-on-ink">
            {archiveError}
          </p>
        )}
      </div>
    </form>
  );
}
