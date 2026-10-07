"use client";

import { Button } from "@/components/ui/button";
import { AffixInput, Checkbox, Field, inputClasses, textareaClasses } from "@/components/ui/field";
import { FormAlert } from "@/components/ui/form-alert";
import { FormSection } from "@/components/ui/section";
import { useFormAction } from "@/lib/use-form-action";
import type { FormState } from "@/server/form-state";
import { saveItem } from "./actions";

export interface ItemFormValues {
  name: string;
  reference: string;
  typeName: string;
  quantity: string;
  description: string;
  dailyRate: string;
  deposit: string;
  storageLocation: string;
  purchasedOn: string;
  purchasePrice: string;
  rentable: boolean;
}

/** Ajout ou modification d'un article. */
export function ItemForm({
  itemId,
  initial,
  types,
}: {
  itemId: string | null;
  initial: ItemFormValues;
  types: string[];
}) {
  const { state, onSubmit, pending } = useFormAction<FormState>(saveItem.bind(null, itemId), {});
  const errors = state.fieldErrors ?? {};
  return (
    <form onSubmit={onSubmit} className="flex max-w-[768px] flex-col gap-10 px-4 py-8 sm:px-10">
      {state.error && <FormAlert>{state.error}</FormAlert>}
      <FormSection number={1} title="Article">
        <Field label="Nom" required error={errors.name}>
          {(field) => (
            <input
              {...field}
              name="name"
              required
              maxLength={120}
              defaultValue={initial.name}
              placeholder="Vidéoprojecteur Epson 4K"
              className={inputClasses()}
            />
          )}
        </Field>
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Catégorie" error={errors.typeName}>
            {(field) => (
              <>
                <input
                  {...field}
                  name="typeName"
                  list="item-types"
                  maxLength={60}
                  defaultValue={initial.typeName}
                  placeholder="Vidéo, Sono…"
                  className={inputClasses()}
                />
                <datalist id="item-types">
                  {types.map((type) => (
                    <option key={type} value={type} />
                  ))}
                </datalist>
              </>
            )}
          </Field>
          <Field
            label="Exemplaires"
            required
            error={errors.quantity}
            hint={
              itemId ? (
                <p className="text-[13px] font-medium text-ink-muted">
                  Ajoute ou retire des exemplaires.
                </p>
              ) : undefined
            }
          >
            {(field) => (
              <AffixInput
                {...field}
                name="quantity"
                inputMode="numeric"
                required
                defaultValue={initial.quantity}
                suffix="ex."
                mono
              />
            )}
          </Field>
          <Field
            label="Référence"
            error={errors.reference}
            hint={<p className="text-[13px] font-medium text-ink-muted">Générée si vide.</p>}
          >
            {(field) => (
              <input
                {...field}
                name="reference"
                maxLength={30}
                defaultValue={initial.reference}
                placeholder="VP-014"
                className={inputClasses("md", "none")}
                style={{ textTransform: "uppercase" }}
              />
            )}
          </Field>
        </div>
        <Field label="Description" error={errors.description}>
          {(field) => (
            <textarea
              {...field}
              name="description"
              rows={3}
              maxLength={2000}
              defaultValue={initial.description}
              className={textareaClasses()}
            />
          )}
        </Field>
      </FormSection>

      <FormSection number={2} title="Tarifs & suivi">
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Tarif" error={errors.dailyRateCents}>
            {(field) => (
              <AffixInput
                {...field}
                name="dailyRate"
                inputMode="decimal"
                defaultValue={initial.dailyRate}
                suffix="€ / jour"
                mono
              />
            )}
          </Field>
          <Field label="Caution" error={errors.depositCents}>
            {(field) => (
              <AffixInput
                {...field}
                name="deposit"
                inputMode="decimal"
                defaultValue={initial.deposit}
                suffix="€"
                mono
              />
            )}
          </Field>
          <Field label="Emplacement" error={errors.storageLocation}>
            {(field) => (
              <input
                {...field}
                name="storageLocation"
                maxLength={120}
                defaultValue={initial.storageLocation}
                placeholder="Local A · étagère 3"
                className={inputClasses()}
              />
            )}
          </Field>
          <Field label="Acheté le" error={errors.purchasedOn}>
            {(field) => (
              <AffixInput
                {...field}
                type="date"
                name="purchasedOn"
                defaultValue={initial.purchasedOn}
              />
            )}
          </Field>
          <Field label="Prix d'achat" error={errors.purchasePriceCents}>
            {(field) => (
              <AffixInput
                {...field}
                name="purchasePrice"
                inputMode="decimal"
                defaultValue={initial.purchasePrice}
                suffix="€"
                mono
              />
            )}
          </Field>
        </div>
        <Checkbox
          name="rentable"
          defaultChecked={initial.rentable}
          label="Proposé à la location sur la page publique"
        />
      </FormSection>

      <div>
        <Button type="submit" pending={pending}>
          {itemId ? "Enregistrer" : "Ajouter l'article"}
        </Button>
      </div>
    </form>
  );
}
