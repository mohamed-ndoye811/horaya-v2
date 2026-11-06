import { Button } from "@/components/ui/button";
import { Field, inputClasses } from "@/components/ui/field";
import { FormAlert } from "@/components/ui/form-alert";
import { savePaymentLinkAction } from "@/functions/auth";
import { useFormAction } from "@/lib/use-form-action";
import type { FormState } from "@/server/form-state";

const HOW_IT_WORKS = [
  "Ton client réserve et reçoit un bouton « Payer ».",
  "Il paie sur ton lien : l'argent arrive directement chez toi.",
  "Tu cliques « Marquer comme payé » dans Horaya.",
];

/** Lien de paiement collé à l'inscription (maquette 4.4). */
export function PaymentLinkForm() {
  const { state, onSubmit, pending } = useFormAction<FormState>(savePaymentLinkAction, {});
  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-5">
      {state.error && <FormAlert>{state.fieldErrors?.paymentLinkUrl ?? state.error}</FormAlert>}
      <Field
        label="Lien de paiement"
        hint={
          <p className="text-xs leading-4 text-ink-subtle">
            Stripe, SumUp, PayPal, Lydia Pro… n'importe quel lien marche.
          </p>
        }
      >
        {(field) => (
          <input
            {...field}
            type="url"
            name="paymentLinkUrl"
            maxLength={500}
            placeholder="https://buy.stripe.com/…"
            className={inputClasses("lg")}
          />
        )}
      </Field>
      <div className="flex flex-col gap-3 rounded-[20px] bg-surface px-[18px] py-4">
        <p className="text-[13px] font-semibold text-ink-subtle">Comment ça marche</p>
        <ol className="flex flex-col gap-2.5">
          {HOW_IT_WORKS.map((line, index) => (
            <li key={line} className="flex items-center gap-3 text-sm leading-5 text-ink">
              <span className="flex size-[22px] shrink-0 items-center justify-center rounded-full bg-ink text-[11px] font-bold text-on-ink">
                {index + 1}
              </span>
              {line}
            </li>
          ))}
        </ol>
      </div>
      <Button size="lg" type="submit" arrow pending={pending} className="w-full">
        Accéder à mon espace
      </Button>
      <a
        href="/app"
        className="text-center text-sm font-medium text-ink-muted hover:text-ink hover:underline"
      >
        Passer : je paierai sur place ou par virement
      </a>
    </form>
  );
}
