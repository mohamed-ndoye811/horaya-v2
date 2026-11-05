"use client";

import {
  FREE_CANCELLATION_HOURS,
  NOTIFICATION_TYPES,
  type NotificationPreference,
} from "@horaya/core";
import { AffixInput, Field, inputClasses } from "@/components/ui/field";
import { FormAlert } from "@/components/ui/form-alert";
import { cardClasses, FormSection } from "@/components/ui/section";
import { Select } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/cn";
import { useFormAction } from "@/lib/use-form-action";
import type { FormState } from "@/server/form-state";
import { savePaymentsAction } from "../actions";

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
  preferences,
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
  preferences: NotificationPreference[];
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

        <section
          id="notifications"
          aria-labelledby="notifications-title"
          className={cn(cardClasses, "min-w-0 scroll-mt-6 sm:p-6")}
        >
          <div className="flex items-center gap-2.5 pb-3">
            <span className="flex size-[26px] shrink-0 items-center justify-center rounded-full bg-ink text-xs font-bold leading-[14px] text-on-ink">
              2
            </span>
            <h2
              id="notifications-title"
              className="grow text-lg font-semibold leading-[22px] text-ink"
            >
              Notifications
            </h2>
            <span className="w-14 shrink-0 text-center text-xs font-semibold text-ink-subtle">
              E-mail
            </span>
            <span className="w-14 shrink-0 text-center text-xs font-semibold text-ink-subtle">
              In-app
            </span>
          </div>
          <ul>
            {NOTIFICATION_TYPES.map((type) => {
              const current = preferences.find((entry) => entry.type === type.value);
              return (
                <li
                  key={type.value}
                  className="flex items-center gap-3 border-t border-[#f4f4f2] py-3"
                >
                  <span className="min-w-0 grow truncate text-sm leading-[18px] text-ink">
                    {type.label}
                  </span>
                  <span className="flex w-14 shrink-0 justify-center">
                    <Switch
                      hideLabel
                      label={`${type.label} par e-mail`}
                      name={`email:${type.value}`}
                      defaultChecked={current?.email ?? type.email}
                    />
                  </span>
                  <span className="flex w-14 shrink-0 justify-center">
                    <Switch
                      hideLabel
                      label={`${type.label} dans l'app`}
                      name={`inApp:${type.value}`}
                      defaultChecked={current?.inApp ?? type.inApp}
                    />
                  </span>
                </li>
              );
            })}
          </ul>
          <p className="pt-2 text-xs leading-4 text-ink-subtle">
            Tes préférences personnelles : chaque membre règle les siennes.
          </p>
        </section>
      </div>
    </form>
  );
}
