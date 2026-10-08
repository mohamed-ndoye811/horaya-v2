"use client";

import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { Button, monoLinkClasses, textLinkClasses } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { AffixInput, Checkbox, Field, inputClasses, textareaClasses } from "@/components/ui/field";
import { FormAlert } from "@/components/ui/form-alert";
import { PlusIcon } from "@/components/ui/icons";
import { cn } from "@/lib/cn";
import { useFormAction } from "@/lib/use-form-action";
import type { FormState } from "@/server/form-state";
import { cancelMaintenanceAction, scheduleMaintenanceAction } from "../actions";

/** « + Ajouter une intervention » : fenêtre de planification d'une maintenance. */
export function AddMaintenance({
  itemId,
  units,
  today,
}: {
  itemId: string;
  units: Array<{ id: string; label: string }>;
  today: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={`${monoLinkClasses} flex items-center gap-1.5 whitespace-nowrap`}
      >
        <PlusIcon size={10} />
        Ajouter une intervention
      </button>
      {open && (
        <MaintenanceDialog
          itemId={itemId}
          units={units}
          today={today}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}

function MaintenanceDialog({
  itemId,
  units,
  today,
  onClose,
}: {
  itemId: string;
  units: Array<{ id: string; label: string }>;
  today: string;
  onClose: () => void;
}) {
  const router = useRouter();
  const { state, onSubmit, pending } = useFormAction<FormState>(async (previous, form) => {
    const result = await scheduleMaintenanceAction(itemId, previous, form);
    if (result.success) {
      onClose();
      router.refresh();
    }
    return result;
  }, {});
  const errors = state.fieldErrors ?? {};
  const unitsBox = useRef<HTMLFieldSetElement>(null);
  const checkAll = (checked: boolean) => {
    for (const box of unitsBox.current?.querySelectorAll<HTMLInputElement>(
      'input[name="unitIds"]',
    ) ?? []) {
      box.checked = checked;
    }
  };
  return (
    <Dialog
      open
      onClose={onClose}
      title="Ajouter une intervention"
      description="Les exemplaires choisis ne pourront pas être réservés pendant l'intervention."
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Annuler
          </Button>
          <Button type="submit" form="maintenance-form" pending={pending}>
            Planifier
          </Button>
        </>
      }
    >
      <form id="maintenance-form" onSubmit={onSubmit} className="flex flex-col gap-4">
        {state.error && <FormAlert>{state.error}</FormAlert>}
        <Field label="Intervention" required error={errors.title}>
          {(field) => (
            <input
              {...field}
              name="title"
              required
              maxLength={120}
              placeholder="Révision lampe"
              className={inputClasses()}
            />
          )}
        </Field>
        <fieldset ref={unitsBox} className="flex flex-col gap-2.5">
          <legend className="mb-2.5 text-sm font-bold text-ink">
            Exemplaires <span className="text-danger">*</span>
          </legend>
          {/* Beaucoup d'exemplaires (150 chaises) : tout cocher d'un coup, liste qui défile. */}
          {units.length > 8 && (
            <div className="flex gap-4 text-sm">
              <button type="button" onClick={() => checkAll(true)} className={textLinkClasses}>
                Tout cocher
              </button>
              <button type="button" onClick={() => checkAll(false)} className={textLinkClasses}>
                Tout décocher
              </button>
            </div>
          )}
          <div
            className={cn(
              "flex flex-wrap gap-x-5 gap-y-2.5",
              units.length > 8 && "max-h-52 overflow-y-auto border-[1.5px] border-line-soft p-3",
            )}
          >
            {units.map((unit) => (
              <Checkbox
                key={unit.id}
                name="unitIds"
                value={unit.id}
                defaultChecked={units.length === 1}
                label={`Exemplaire ${unit.label}`}
              />
            ))}
          </div>
          {errors.unitIds && (
            <p className="text-[13px] font-semibold text-danger">{errors.unitIds}</p>
          )}
        </fieldset>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Du" required error={errors.startsAt}>
            {(field) => (
              <AffixInput {...field} type="date" name="startDate" required defaultValue={today} />
            )}
          </Field>
          <Field label="Au (inclus)" required error={errors.endsAt}>
            {(field) => (
              <AffixInput {...field} type="date" name="endDate" required defaultValue={today} />
            )}
          </Field>
          <Field label="Prestataire" error={errors.provider}>
            {(field) => (
              <input
                {...field}
                name="provider"
                maxLength={120}
                placeholder="En interne, atelier…"
                className={inputClasses()}
              />
            )}
          </Field>
          <Field label="Coût" error={errors.costCents}>
            {(field) => <AffixInput {...field} name="cost" inputMode="decimal" suffix="€" mono />}
          </Field>
        </div>
        <Field label="Note" error={errors.note}>
          {(field) => (
            <textarea
              {...field}
              name="note"
              rows={2}
              maxLength={1000}
              className={textareaClasses()}
            />
          )}
        </Field>
      </form>
    </Dialog>
  );
}

/** Annuler une intervention planifiée (toutes ses lignes d'exemplaires). */
export function CancelMaintenance({ allocationIds }: { allocationIds: string[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <span className="flex flex-col items-end gap-1">
      <button
        type="button"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            const result = await cancelMaintenanceAction(allocationIds);
            if (result.error) setError(result.error);
            else router.refresh();
          })
        }
        className={`${textLinkClasses} text-[13px] disabled:cursor-not-allowed disabled:opacity-50`}
      >
        Annuler
      </button>
      {error && <span className="text-[13px] font-semibold text-danger">{error}</span>}
    </span>
  );
}
