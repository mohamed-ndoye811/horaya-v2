import { FREE_CANCELLATION_HOURS } from "@horaya/core";
import { AffixInput, Field, inputClasses } from "@/components/ui/field";
import { FormAlert } from "@/components/ui/form-alert";
import { FormSection } from "@/components/ui/section";
import { Select } from "@/components/ui/select";
import { savePaymentsAction } from "@/functions/settings";
import { useFormAction } from "@/lib/use-form-action";
import type { FormState } from "@/server/form-state";

const freeCancellationLabel = (hours: number) =>
  hours === 0
    ? "Pas d'annulation gratuite"
    : hours % 24 === 0 && hours >= 48 && hours !== 72
      ? `Remboursement intégral jusqu'à ${hours / 24} jours avant`
      : `Remboursement intégral jusqu'à ${hours} h avant`;

const REFUND_OPTIONS = [0, 25, 50, 75];

export function PaymentsForm({
  editable,
  initial,
  showPaymentLink,
}: {
  editable: boolean;
  initial: {
    vatRate: string;
    defaultDepositPercent: string;
    freeCancellationHours: number;
    lateCancellationRefundPercent: number;
    paymentLinkUrl: string;
  };
  /** Paiement par lien (pas de Stripe intégré) : lien par défaut de l'espace. */
  showPaymentLink: boolean;
}) {
  const { state, onSubmit } = useFormAction<FormState>(savePaymentsAction, {});
  const errors = state.fieldErrors ?? {};
  const hours = FREE_CANCELLATION_HOURS.includes(
    initial.freeCancellationHours as (typeof FREE_CANCELLATION_HOURS)[number],
  )
    ? [...FREE_CANCELLATION_HOURS]
    : [...FREE_CANCELLATION_HOURS, initial.freeCancellationHours].sort((a, b) => a - b);
  const refunds = REFUND_OPTIONS.includes(initial.lateCancellationRefundPercent)
    ? REFUND_OPTIONS
    : [...REFUND_OPTIONS, initial.lateCancellationRefundPercent].sort((a, b) => a - b);

  return (
    <form id="payments-form" onSubmit={onSubmit} className="flex flex-col gap-4">
      {state.error && <FormAlert>{state.error}</FormAlert>}
      {state.success && <FormAlert tone="success">{state.success}</FormAlert>}
      <div className="flex flex-col gap-4">
        <fieldset disabled={!editable} className="min-w-0">
          <FormSection number={1} title="Réglages">
            {!editable && (
              <p className="text-xs leading-4 text-ink-subtle">
                Seuls le propriétaire et les admins peuvent modifier ces réglages.
              </p>
            )}
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              <Field label="Devise">
                {(field) => (
                  <Select {...field} disabled defaultValue="EUR">
                    <option value="EUR">Euro (€)</option>
                  </Select>
                )}
              </Field>
              <Field label="TVA appliquée" error={errors.vatRateBps}>
                {(field) => (
                  <AffixInput
                    {...field}
                    name="vatRate"
                    inputMode="decimal"
                    required
                    defaultValue={initial.vatRate}
                    suffix="%"
                  />
                )}
              </Field>
              <Field
                label="Acompte par défaut"
                error={errors.defaultDepositPercent}
                hint={
                  <p className="text-xs leading-4 text-ink-subtle">
                    Proposé quand un événement demande un acompte.
                  </p>
                }
              >
                {(field) => (
                  <AffixInput
                    {...field}
                    name="defaultDepositPercent"
                    inputMode="numeric"
                    required
                    defaultValue={initial.defaultDepositPercent}
                    suffix="% du total"
                  />
                )}
              </Field>
            </div>
            <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_280px]">
              <Field label="Politique d'annulation" error={errors.freeCancellationHours}>
                {(field) => (
                  <Select
                    {...field}
                    name="freeCancellationHours"
                    defaultValue={String(initial.freeCancellationHours)}
                  >
                    {hours.map((value) => (
                      <option key={value} value={value}>
                        {freeCancellationLabel(value)}
                      </option>
                    ))}
                  </Select>
                )}
              </Field>
              <Field label="Annulation plus tardive" error={errors.lateCancellationRefundPercent}>
                {(field) => (
                  <Select
                    {...field}
                    name="lateCancellationRefundPercent"
                    defaultValue={String(initial.lateCancellationRefundPercent)}
                  >
                    {refunds.map((value) => (
                      <option key={value} value={value}>
                        {value === 0 ? "Aucun remboursement" : `Remboursement de ${value} %`}
                      </option>
                    ))}
                  </Select>
                )}
              </Field>
            </div>
            {showPaymentLink && (
              <Field
                label="Lien de paiement par défaut"
                error={errors.paymentLinkUrl}
                hint={
                  <p className="text-xs leading-4 text-ink-subtle">
                    Pour les événements payés en ligne ou par acompte qui n'ont pas leur propre
                    lien.
                  </p>
                }
              >
                {(field) => (
                  <input
                    {...field}
                    type="url"
                    name="paymentLinkUrl"
                    maxLength={500}
                    defaultValue={initial.paymentLinkUrl}
                    placeholder="https://buy.stripe.com/…"
                    className={inputClasses()}
                  />
                )}
              </Field>
            )}
          </FormSection>
        </fieldset>
      </div>
    </form>
  );
}
