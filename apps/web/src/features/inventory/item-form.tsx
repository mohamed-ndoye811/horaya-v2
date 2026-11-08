import {
  FIELD_TYPES,
  type FieldDefinition,
  type FieldValues,
  itemFieldsSchema,
} from "@horaya/core";
import { useRef, useState } from "react";
import { FieldInputs } from "@/components/app/field-inputs";
import { ActionBar } from "@/components/ui/action-bar";
import { Button } from "@/components/ui/button";
import { AffixInput, Checkbox, Field, inputClasses, textareaClasses } from "@/components/ui/field";
import { FormAlert } from "@/components/ui/form-alert";
import { BoxIcon } from "@/components/ui/icons";
import { cardClasses, cardShellClasses, dashedClasses, FormSection } from "@/components/ui/section";
import { Tag } from "@/components/ui/tag";
import { type EditableField, FieldListEditor } from "@/features/events/field-list-editor";
import { saveItem } from "@/functions/inventory";
import { cn } from "@/lib/cn";
import { useFormAction } from "@/lib/use-form-action";
import type { FormState } from "@/server/form-state";

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
  fieldValues = {},
}: {
  itemId: string | null;
  initial: ItemFormValues;
  /** Catégories existantes et leurs champs. */
  types: Array<{ name: string; fields: FieldDefinition[] }>;
  /** Valeurs des champs de sa catégorie (modification). */
  fieldValues?: FieldValues;
}) {
  const { state, onSubmit, pending } = useFormAction<FormState>(saveItem.bind(null, itemId), {});
  const errors = state.fieldErrors ?? {};
  // Aperçu public et barre d'action, mis à jour à chaque frappe.
  const [preview, setPreview] = useState(initial);
  const typeRef = useRef<HTMLInputElement>(null);
  const read = (form: HTMLFormElement) => {
    const data = new FormData(form);
    const text = (key: string) => String(data.get(key) ?? "");
    setPreview({
      ...initial,
      name: text("name"),
      typeName: text("typeName"),
      quantity: text("quantity"),
      dailyRate: text("dailyRate"),
      deposit: text("deposit"),
    });
  };
  const quantity = Math.max(0, Number.parseInt(preview.quantity, 10) || 0);
  // Champs de la catégorie choisie : ceux enregistrés, ou ceux modifiés ici (envoyés avec l'article).
  const category = preview.typeName.trim();
  const [edited, setEdited] = useState<Record<string, EditableField[]>>({});
  const categoryFields =
    edited[category] ?? types.find((type) => type.name === category)?.fields ?? [];
  const labels = Array.from({ length: Math.min(quantity, 3) }, (_, index) => `#${index + 1}`);
  return (
    <form
      onSubmit={onSubmit}
      onChange={(event) => read(event.currentTarget)}
      className="grid items-start gap-4 px-4 pb-4 xl:grid-cols-[minmax(0,1fr)_340px]"
    >
      <div className="flex min-w-0 flex-col gap-4">
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
          <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_150px_180px]">
            <Field
              label="Catégorie"
              error={errors.typeName}
              hint={
                types.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {types.slice(0, 6).map(({ name }) => (
                      <button
                        key={name}
                        type="button"
                        onClick={(event) => {
                          if (!typeRef.current) return;
                          typeRef.current.value = name;
                          const form = event.currentTarget.form;
                          if (form) read(form);
                        }}
                        className="h-8 rounded-full bg-field px-3 text-xs font-semibold leading-4 text-ink-soft hover:bg-line-soft"
                      >
                        {name}
                      </button>
                    ))}
                  </div>
                )
              }
            >
              {(field) => (
                <>
                  <input
                    {...field}
                    ref={typeRef}
                    name="typeName"
                    list="item-types"
                    maxLength={60}
                    defaultValue={initial.typeName}
                    placeholder="Vidéo, Sono…"
                    className={inputClasses()}
                  />
                  <datalist id="item-types">
                    {types.map(({ name }) => (
                      <option key={name} value={name} />
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

        {category && (
          <FormSection number={3} title={`Champs de « ${category} »`}>
            <p className="text-[13px] font-medium leading-[18px] text-ink-muted">
              Les mêmes pour tous les articles de la catégorie : chacun y met ses valeurs.
            </p>
            {edited[category] && (
              <input type="hidden" name="typeFields" value={JSON.stringify(edited[category])} />
            )}
            <FieldListEditor
              fields={categoryFields}
              scope={undefined}
              all={categoryFields}
              types={FIELD_TYPES.filter((type) => type !== "acceptance")}
              onChange={(next) => {
                const result = itemFieldsSchema.safeParse(next);
                if (!result.success) return result.error.issues[0]?.message ?? "Champ invalide";
                setEdited((current) => ({ ...current, [category]: next }));
                return null;
              }}
              addLabel="Ajouter un champ"
              addHint="numéro de série, puissance, taille…"
            />
            <FieldInputs
              key={category}
              fields={categoryFields}
              prefix="v."
              errorPrefix="fieldValues."
              defaults={category === initial.typeName ? fieldValues : {}}
              errors={errors}
            />
          </FormSection>
        )}

        <ActionBar
          message={
            itemId ? undefined : quantity > 0 ? (
              <>
                <strong>
                  {quantity} exemplaire{quantity > 1 ? "s" : ""}
                </strong>{" "}
                {quantity > 1 ? "seront créés" : "sera créé"} :{" "}
                {labels.join(", ").replace(/, (#\d+)$/, " et $1")}
                {quantity > 3 ? "…" : "."}
              </>
            ) : (
              "Indique le nombre d'exemplaires."
            )
          }
        >
          <Button type="submit" variant="inverse" pending={pending}>
            {itemId ? "Enregistrer" : "Ajouter l'article"}
          </Button>
        </ActionBar>
      </div>

      <aside className="flex flex-col gap-4">
        <section className={cn(cardClasses, "gap-3")}>
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold leading-5 text-ink">Photos</h2>
            <Tag tone="info">À venir</Tag>
          </div>
          <div
            className={cn(
              dashedClasses,
              "flex h-24 flex-col items-center justify-center gap-0.5 rounded-2xl text-center",
            )}
          >
            <p className="text-[13px] font-semibold leading-[17px] text-ink-subtle">
              Glisse tes photos
            </p>
            <p className="text-[11px] leading-[14px] text-ink-faint">JPG ou PNG · 5 max</p>
          </div>
          <p className="text-xs leading-4 text-ink-subtle">
            La première photo servira de vignette dans les listes et sur ta page publique.
          </p>
        </section>
        <section className={cn(cardShellClasses, "overflow-hidden")}>
          <div className="relative flex h-[150px] items-center justify-center bg-field text-ink-subtle">
            <span className="absolute top-3 left-3">
              <Tag tone="overlay">Aperçu public</Tag>
            </span>
            <BoxIcon size={44} />
          </div>
          <div className="flex flex-col gap-1 px-4 py-3.5">
            <p className="truncate text-[17px] font-semibold leading-[22px] text-ink">
              {preview.name || "Nom de l'article"}
            </p>
            <p className="text-[13px] leading-[17px] text-ink-subtle">
              {[
                preview.dailyRate ? `${preview.dailyRate} € / jour` : null,
                preview.deposit ? `caution ${preview.deposit} €` : null,
                quantity > 0 ? `${quantity} disponible${quantity > 1 ? "s" : ""}` : null,
              ]
                .filter(Boolean)
                .join(" · ") || "Tarif à définir"}
            </p>
          </div>
        </section>
      </aside>
    </form>
  );
}
