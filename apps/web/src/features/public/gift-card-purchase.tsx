import type { GiftCardSettings } from "@horaya/core";
import { useState } from "react";
import { Collapse } from "@/components/motion/collapse";
import { Button } from "@/components/ui/button";
import { AffixInput, Field, inputClasses, textareaClasses } from "@/components/ui/field";
import { FormAlert } from "@/components/ui/form-alert";
import { FormSection } from "@/components/ui/section";
import { purchaseGiftCardAction } from "@/functions/gift-cards";
import { cn } from "@/lib/cn";
import { displayFontClass } from "@/lib/fonts";
import { formatMoney } from "@/lib/format";
import { useFormAction } from "@/lib/use-form-action";
import type { FormState } from "@/server/form-state";

/** « Offrir un bon cadeau » : montant, acheteur, bénéficiaire, message, puis lien de paiement. */
export function GiftCardPurchase({
  workspace,
  settings,
}: {
  workspace: { slug: string; name: string; displayFont: string };
  settings: GiftCardSettings;
}) {
  const { state, onSubmit, pending } = useFormAction<FormState>(
    purchaseGiftCardAction.bind(null, workspace.slug),
    {},
  );
  const errors = state.fieldErrors ?? {};
  const [amount, setAmount] = useState(
    String(settings.amountsCents[1] ?? settings.amountsCents[0] ?? "") || "autre",
  );
  const months = settings.validityMonths;

  return (
    <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
      <form onSubmit={onSubmit} className="reveal-group flex min-w-0 flex-1 flex-col gap-4">
        <header className="flex flex-col gap-2 px-1 pt-2">
          <h1
            className={cn(
              "text-[36px] leading-10 tracking-[-0.035em] text-ink sm:text-kpi sm:leading-[48px]",
              displayFontClass(workspace.displayFont),
            )}
          >
            Offrir un bon cadeau
          </h1>
          <p className="text-base leading-6 text-ink-muted">
            Un moment à partager chez {workspace.name}, valable {months} mois.
          </p>
        </header>
        {state.error && <FormAlert>{state.error}</FormAlert>}
        <FormSection number={1} title="Montant">
          <div role="radiogroup" aria-label="Montant" className="flex flex-wrap gap-2.5">
            {settings.amountsCents.map((cents) => (
              <label key={cents} className="cursor-pointer">
                <input
                  type="radio"
                  name="amount"
                  value={String(cents / 100)}
                  checked={amount === String(cents)}
                  onChange={() => setAmount(String(cents))}
                  className="peer sr-only"
                />
                <span className="flex h-12 min-w-[88px] items-center justify-center rounded-2xl border-[1.5px] border-line bg-surface px-4 text-base font-semibold text-ink press peer-checked:border-[var(--brand)] peer-checked:bg-[var(--brand)] peer-checked:text-[var(--on-brand)] peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-ink">
                  {formatMoney(cents)}
                </span>
              </label>
            ))}
            {settings.customAmount && (
              <label className="cursor-pointer">
                <input
                  type="radio"
                  name="amount"
                  value="autre"
                  checked={amount === "autre"}
                  onChange={() => setAmount("autre")}
                  className="peer sr-only"
                />
                <span className="flex h-12 min-w-[88px] items-center justify-center rounded-2xl border-[1.5px] border-line bg-surface px-4 text-base font-semibold text-ink press peer-checked:border-[var(--brand)] peer-checked:bg-[var(--brand)] peer-checked:text-[var(--on-brand)] peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-ink">
                  Autre montant
                </span>
              </label>
            )}
          </div>
          <Collapse open={amount === "autre"}>
            <Field
              label="Montant libre"
              error={errors.amountCents}
              hint={
                <p className="text-meta font-medium text-ink-muted">
                  Entre {formatMoney(settings.minCents)} et {formatMoney(settings.maxCents)}.
                </p>
              }
            >
              {(field) => (
                <AffixInput
                  {...field}
                  name="customAmount"
                  inputMode="decimal"
                  required
                  suffix="€"
                  mono
                />
              )}
            </Field>
          </Collapse>
          {amount !== "autre" && errors.amountCents && (
            <p className="animate-drop text-meta font-semibold text-danger">{errors.amountCents}</p>
          )}
        </FormSection>
        <FormSection number={2} title="Toi">
          <div className="auth-fields grid gap-3 sm:grid-cols-2">
            <Field label="Ton nom" required error={errors.purchaserName}>
              {(field) => (
                <input
                  {...field}
                  name="purchaserName"
                  required
                  maxLength={120}
                  autoComplete="name"
                  className={inputClasses()}
                />
              )}
            </Field>
            <Field label="Ton e-mail" required error={errors.purchaserEmail}>
              {(field) => (
                <input
                  {...field}
                  type="email"
                  name="purchaserEmail"
                  required
                  autoComplete="email"
                  className={inputClasses()}
                />
              )}
            </Field>
          </div>
        </FormSection>
        <FormSection number={3} title="La personne à qui tu l'offres">
          <div className="auth-fields grid gap-3 sm:grid-cols-2">
            <Field label="Son nom" required error={errors.recipientName}>
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
            <Field
              label="Son e-mail (facultatif)"
              error={errors.recipientEmail}
              hint={
                <p className="text-meta font-medium text-ink-muted">
                  Elle recevra le bon directement. Sinon, il t'est envoyé, à toi de lui donner.
                </p>
              }
            >
              {(field) => (
                <input {...field} type="email" name="recipientEmail" className={inputClasses()} />
              )}
            </Field>
          </div>
          <Field label="Un petit mot (facultatif)" error={errors.message}>
            {(field) => (
              <textarea
                {...field}
                name="message"
                rows={3}
                maxLength={500}
                className={cn(textareaClasses(), "bg-surface")}
              />
            )}
          </Field>
        </FormSection>
        <div className="flex flex-col gap-3 rounded-[28px] bg-ink p-2.5 sm:flex-row sm:items-center sm:justify-between sm:rounded-full sm:pl-6">
          <p className="px-3 pt-1 text-sm leading-[18px] text-notch-idle sm:p-0">
            Tu paies ensuite via le lien de {workspace.name}, qui active ton bon.
          </p>
          <Button type="submit" variant="brand" pending={pending} arrow>
            {pending ? "Un instant…" : "Continuer"}
          </Button>
        </div>
      </form>
      {settings.message && (
        <aside className="flex w-full shrink-0 flex-col gap-2 rounded-3xl bg-surface p-6 lg:sticky lg:top-[62px] lg:w-[360px]">
          <p className="text-meta font-semibold leading-4 text-ink-muted">Bon à savoir</p>
          <p className="whitespace-pre-line text-ui leading-[23px] text-ink">{settings.message}</p>
        </aside>
      )}
    </div>
  );
}
