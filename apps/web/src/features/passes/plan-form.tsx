import { isRedirect, useRouter } from "@tanstack/react-router";
import { useId, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { AffixInput, Field, inputClasses } from "@/components/ui/field";
import { FormAlert } from "@/components/ui/form-alert";
import { archivePassPlanAction, savePassPlan } from "@/functions/passes";
import { cn } from "@/lib/cn";
import { formatMoney, plural } from "@/lib/format";
import { centsToInput, parseEuroToCents } from "@/lib/money";
import { useFormAction } from "@/lib/use-form-action";
import type { FormState } from "@/server/form-state";
import { formatValidity } from "./validity";

export interface PlanFormValues {
  id: string | null;
  name: string;
  sessions: number;
  priceCents: number;
  validityDays: number;
  eventTypeIds: string[];
  archived: boolean;
}

/**
 * Fenêtre « Formule de carte » : nom, séances, prix, validité, types acceptés, et en bas ce que
 * l'élève achète vraiment (prix de la séance, durée), calculé pendant la saisie.
 */
export function PlanDialog({
  initial,
  eventTypes,
}: {
  initial: PlanFormValues;
  eventTypes: Array<{ id: string; name: string }>;
}) {
  const formId = useId();
  const { state, onSubmit, pending } = useFormAction<FormState>(
    savePassPlan.bind(null, initial.id),
    {},
  );
  const router = useRouter();
  const [archiving, setArchiving] = useState(false);
  const [archiveError, setArchiveError] = useState<string | null>(null);
  const [draft, setDraft] = useState({
    sessions: initial.sessions,
    priceCents: initial.priceCents,
    validityDays: initial.validityDays,
  });
  const errors = state.fieldErrors ?? {};
  const close = () => router.navigate({ to: "/app/cartes" });

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

  const { sessions, priceCents, validityDays } = draft;
  const summary =
    sessions > 0 && priceCents > 0 ? (
      <>
        <strong>{formatMoney(priceCents)}</strong> pour {plural(sessions, "séance")}, soit{" "}
        <strong>{formatMoney(Math.round(priceCents / sessions))} la séance</strong>
        {validityDays > 0 && <>, à utiliser en {formatValidity(validityDays)} après le paiement</>}.
      </>
    ) : (
      "Indique le nombre de séances et le prix : on calcule le prix de la séance."
    );

  return (
    <Dialog
      open
      onClose={close}
      density="compact"
      title={initial.id ? "Modifier la formule" : "Nouvelle formule"}
      description="Tes élèves l'achètent sur ta page publique, ou tu la vends depuis leur fiche."
      footer={
        <div className="flex w-full flex-col gap-2">
          {archiveError && <FormAlert>{archiveError}</FormAlert>}
          <div className="flex items-center gap-2">
            {initial.id && (
              <Button
                type="button"
                size="sm"
                variant={initial.archived ? "secondary" : "danger"}
                pending={archiving}
                onClick={toggleArchive}
              >
                {initial.archived ? "Remettre en vente" : "Archiver"}
              </Button>
            )}
            <Button type="submit" form={formId} size="sm" pending={pending} className="ml-auto">
              {initial.id ? "Enregistrer" : "Créer la formule"}
            </Button>
          </div>
        </div>
      }
    >
      <form
        id={formId}
        onSubmit={onSubmit}
        onChange={(event) => {
          const form = new FormData(event.currentTarget);
          setDraft({
            sessions: Number(form.get("sessions")) || 0,
            priceCents: parseEuroToCents(String(form.get("price") ?? "")) || 0,
            validityDays: Number(form.get("validityDays")) || 0,
          });
        }}
        className="flex flex-col gap-3"
      >
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
              autoFocus
              // Nom d'une formule, pas d'une personne : pas de suggestion des gestionnaires de mots de passe.
              autoComplete="off"
              data-1p-ignore
              className={inputClasses("xs")}
            />
          )}
        </Field>
        <div className="grid grid-cols-3 gap-3">
          <Field label="Séances" required error={errors.sessions}>
            {(field) => (
              <AffixInput
                {...field}
                size="xs"
                name="sessions"
                inputMode="numeric"
                required
                defaultValue={initial.sessions || ""}
                placeholder="10"
              />
            )}
          </Field>
          <Field label="Prix" required error={errors.priceCents}>
            {(field) => (
              <AffixInput
                {...field}
                size="xs"
                name="price"
                inputMode="decimal"
                required
                defaultValue={initial.id ? centsToInput(initial.priceCents) : ""}
                placeholder="120"
                suffix="€"
              />
            )}
          </Field>
          <Field label="Validité" required error={errors.validityDays}>
            {(field) => (
              <AffixInput
                {...field}
                size="xs"
                name="validityDays"
                inputMode="numeric"
                required
                defaultValue={initial.validityDays || ""}
                placeholder="180"
                suffix="jours"
              />
            )}
          </Field>
        </div>
        <p className="rounded-xl bg-field px-3.5 py-2.5 text-[13px] leading-[18px] text-ink-muted [&_strong]:font-semibold [&_strong]:text-ink">
          {summary}
        </p>
        {eventTypes.length > 0 && (
          <fieldset className="flex flex-col gap-2">
            <legend className="mb-2 text-[13px] font-semibold leading-4 text-ink">
              Valable pour{" "}
              <span className="font-normal text-ink-subtle">· rien de coché : tous les types</span>
            </legend>
            <div className="flex flex-wrap gap-2">
              {eventTypes.map((type) => (
                <label
                  key={type.id}
                  className={cn(
                    "flex h-8 items-center rounded-full border border-line-soft bg-field px-3 text-[13px] font-semibold text-ink transition-colors hover:bg-line-soft",
                    "has-checked:border-ink has-checked:bg-ink has-checked:text-on-ink",
                    "has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-ink",
                  )}
                >
                  <input
                    type="checkbox"
                    name="eventTypeIds"
                    value={type.id}
                    defaultChecked={initial.eventTypeIds.includes(type.id)}
                    className="sr-only"
                  />
                  {type.name}
                </label>
              ))}
            </div>
          </fieldset>
        )}
        {initial.id && (
          <p className="text-[13px] leading-[18px] text-ink-subtle">
            Les cartes déjà vendues gardent les conditions du jour de leur vente.
          </p>
        )}
      </form>
    </Dialog>
  );
}
