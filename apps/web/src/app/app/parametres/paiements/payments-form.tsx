"use client";

import {
  FREE_CANCELLATION_HOURS,
  NOTIFICATION_TYPES,
  type NotificationPreference,
} from "@horaya/core";
import { AffixInput, Field } from "@/components/ui/field";
import { FormAlert } from "@/components/ui/form-alert";
import { FormSection } from "@/components/ui/section";
import { Select } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
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
}: {
  editable: boolean;
  initial: {
    vatRate: string;
    defaultDepositPercent: string;
    freeCancellationHours: number;
    lateCancellationRefundPercent: number;
  };
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
    <form id="payments-form" onSubmit={onSubmit} className="flex flex-col gap-6">
      {state.error && <FormAlert>{state.error}</FormAlert>}
      {state.success && <FormAlert tone="success">{state.success}</FormAlert>}
      <div className="grid gap-10 xl:grid-cols-2 xl:gap-8">
        <fieldset disabled={!editable} className="min-w-0">
          <FormSection number={1} title="Réglages">
            {!editable && (
              <p className="text-[13px] font-medium text-ink-muted">
                Seuls le propriétaire et les admins peuvent modifier ces réglages.
              </p>
            )}
            <div className="grid gap-3 sm:grid-cols-2">
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
                    mono
                  />
                )}
              </Field>
            </div>
            <Field
              label="Acompte par défaut"
              error={errors.defaultDepositPercent}
              hint={
                <p className="text-[13px] font-medium text-ink-muted">
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
                  mono
                />
              )}
            </Field>
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
          </FormSection>
        </fieldset>

        <section
          id="notifications"
          aria-labelledby="notifications-title"
          className="flex min-w-0 scroll-mt-6 flex-col"
        >
          <div className="flex items-baseline gap-3 border-b-2 border-ink pb-2.5">
            <span className="font-mono text-label font-semibold tracking-[0.055em] text-ink-muted">
              02
            </span>
            <h2
              id="notifications-title"
              className="grow font-section text-section leading-7 text-ink"
            >
              Notifications
            </h2>
            <span className="w-14 shrink-0 text-center font-mono text-[11px] font-semibold uppercase tracking-[0.5px] text-ink">
              E-mail
            </span>
            <span className="w-14 shrink-0 text-center font-mono text-[11px] font-semibold uppercase tracking-[0.5px] text-ink">
              In-app
            </span>
          </div>
          <ul>
            {NOTIFICATION_TYPES.map((type) => {
              const current = preferences.find((entry) => entry.type === type.value);
              return (
                <li
                  key={type.value}
                  className="flex items-center gap-3 border-b border-line-soft py-3 last:border-b-0"
                >
                  <span className="min-w-0 grow truncate text-[15px] font-semibold text-ink">
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
          <p className="mt-3 text-[13px] font-medium text-ink-muted">
            Tes préférences personnelles : chaque membre règle les siennes.
          </p>
        </section>
      </div>
    </form>
  );
}
