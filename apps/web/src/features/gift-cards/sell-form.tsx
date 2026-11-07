import { Button } from "@/components/ui/button";
import { AffixInput, Checkbox, Field, inputClasses, textareaClasses } from "@/components/ui/field";
import { FormAlert } from "@/components/ui/form-alert";
import { FormSection } from "@/components/ui/section";
import { sellGiftCardAction } from "@/functions/gift-cards";
import { useFormAction } from "@/lib/use-form-action";
import type { FormState } from "@/server/form-state";

/** Vente d'un bon au comptoir : encaissé sur place, il est actif tout de suite. */
export function SellGiftCardForm() {
  const { state, onSubmit, pending } = useFormAction<FormState>(sellGiftCardAction, {});
  const errors = state.fieldErrors ?? {};
  return (
    <form onSubmit={onSubmit} className="flex max-w-[760px] flex-col gap-4 px-4 pb-4">
      {state.error && <FormAlert>{state.error}</FormAlert>}
      <FormSection number={1} title="Le bon">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Montant" required error={errors.amountCents}>
            {(field) => (
              <AffixInput {...field} name="amount" inputMode="decimal" required suffix="€" mono />
            )}
          </Field>
        </div>
        <Field label="Message pour le bénéficiaire" error={errors.message}>
          {(field) => (
            <textarea
              {...field}
              name="message"
              rows={2}
              maxLength={500}
              className={textareaClasses()}
            />
          )}
        </Field>
      </FormSection>
      <FormSection number={2} title="Acheteur et bénéficiaire">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Nom de l'acheteur" required error={errors.purchaserName}>
            {(field) => (
              <input
                {...field}
                name="purchaserName"
                required
                maxLength={120}
                className={inputClasses()}
              />
            )}
          </Field>
          <Field label="E-mail de l'acheteur" required error={errors.purchaserEmail}>
            {(field) => (
              <input
                {...field}
                type="email"
                name="purchaserEmail"
                required
                className={inputClasses()}
              />
            )}
          </Field>
          <Field label="Nom du bénéficiaire" required error={errors.recipientName}>
            {(field) => (
              <input
                {...field}
                name="recipientName"
                required
                maxLength={120}
                className={inputClasses()}
              />
            )}
          </Field>
          <Field label="E-mail du bénéficiaire" error={errors.recipientEmail}>
            {(field) => (
              <input {...field} type="email" name="recipientEmail" className={inputClasses()} />
            )}
          </Field>
        </div>
        <Checkbox
          name="paid"
          defaultChecked
          label="Déjà encaissé : activer le bon et envoyer l'e-mail"
        />
        <div className="flex justify-end border-t border-line-soft pt-5">
          <Button type="submit" pending={pending}>
            Créer le bon
          </Button>
        </div>
      </FormSection>
    </form>
  );
}
