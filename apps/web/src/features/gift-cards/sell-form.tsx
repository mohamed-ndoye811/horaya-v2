import { useId, useRef, useState } from "react";
import { Disclosure } from "@/components/motion/collapse";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { AffixInput, Checkbox, Field, inputClasses, textareaClasses } from "@/components/ui/field";
import { FormAlert } from "@/components/ui/form-alert";
import { sellGiftCardAction } from "@/functions/gift-cards";
import { cn } from "@/lib/cn";
import { centsToInput } from "@/lib/money";
import { useFormAction } from "@/lib/use-form-action";
import type { FormState } from "@/server/form-state";

/**
 * Fenêtre « Vendre un bon » (comptoir) : montant (raccourcis des montants proposés), qui offre,
 * à qui, message replié. Encaissé sur place, le bon est actif tout de suite.
 */
export function SellGiftCardDialog({
  amountsCents,
  onClose,
}: {
  amountsCents: number[];
  onClose: () => void;
}) {
  const formId = useId();
  const { state, onSubmit, pending } = useFormAction<FormState>(sellGiftCardAction, {});
  const errors = state.fieldErrors ?? {};
  const amount = useRef<HTMLInputElement>(null);
  const [picked, setPicked] = useState<string>("");
  const pick = (value: string) => {
    setPicked(value);
    if (amount.current) amount.current.value = value;
  };

  return (
    <Dialog
      open
      onClose={onClose}
      density="compact"
      title="Vendre un bon cadeau"
      description="Vente au comptoir : un montant à offrir, utilisable sur tes réservations."
      footer={
        <Button type="submit" form={formId} size="sm" pending={pending}>
          Créer le bon
        </Button>
      }
    >
      <form id={formId} onSubmit={onSubmit} className="flex flex-col gap-3">
        {state.error && !state.fieldErrors && <FormAlert>{state.error}</FormAlert>}
        <Field label="Montant" required error={errors.amountCents}>
          {(field) => (
            <div className="flex flex-wrap items-center gap-2">
              {amountsCents.map((cents) => {
                const value = centsToInput(cents).replace(",00", "");
                return (
                  <button
                    key={cents}
                    type="button"
                    onClick={() => pick(value)}
                    aria-pressed={picked === value}
                    className={cn(
                      "flex h-9 items-center rounded-full border px-3.5 text-[13px] font-semibold transition-colors",
                      picked === value
                        ? "border-ink bg-ink text-on-ink"
                        : "border-line-soft bg-field text-ink hover:bg-line-soft",
                    )}
                  >
                    {value} €
                  </button>
                );
              })}
              <div className="w-32">
                <AffixInput
                  {...field}
                  ref={amount}
                  size="xs"
                  name="amount"
                  inputMode="decimal"
                  required
                  placeholder={amountsCents.length > 0 ? "Autre" : "50"}
                  onChange={(event) => setPicked(event.target.value)}
                  suffix="€"
                  mono
                />
              </div>
            </div>
          )}
        </Field>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Offert par" required error={errors.purchaserName}>
            {(field) => (
              <input
                {...field}
                name="purchaserName"
                required
                maxLength={120}
                placeholder="Nom de l'acheteur"
                className={inputClasses("xs")}
              />
            )}
          </Field>
          <Field label="Son e-mail" required error={errors.purchaserEmail}>
            {(field) => (
              <input
                {...field}
                type="email"
                name="purchaserEmail"
                required
                placeholder="Il reçoit le bon"
                className={inputClasses("xs")}
              />
            )}
          </Field>
          <Field label="Pour" required error={errors.recipientName}>
            {(field) => (
              <input
                {...field}
                name="recipientName"
                required
                maxLength={120}
                placeholder="Nom du bénéficiaire"
                className={inputClasses("xs")}
              />
            )}
          </Field>
          <Field label="Son e-mail" error={errors.recipientEmail}>
            {(field) => (
              <input
                {...field}
                type="email"
                name="recipientEmail"
                placeholder="Facultatif"
                className={inputClasses("xs")}
              />
            )}
          </Field>
        </div>
        <Disclosure
          summary={(open) => (open ? "Message" : "+ Ajouter un message")}
          summaryClassName="self-start text-[13px] font-semibold text-ink hover:underline"
          className="flex flex-col gap-2"
        >
          <textarea
            name="message"
            rows={2}
            maxLength={500}
            aria-label="Message pour le bénéficiaire"
            placeholder="Joyeux anniversaire ! Un moment de création rien que pour toi."
            className={cn(textareaClasses(), "mt-2 min-h-20")}
          />
        </Disclosure>
        <Checkbox
          name="paid"
          defaultChecked
          label="Déjà encaissé : le bon est actif tout de suite et l'acheteur le reçoit par e-mail"
        />
      </form>
    </Dialog>
  );
}
