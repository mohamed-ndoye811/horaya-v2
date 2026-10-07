"use client";

import { rentalDays } from "@horaya/core";
import { useState } from "react";
import { type CustomerDefaults, CustomerFields } from "@/components/app/customer-fields";
import { Button } from "@/components/ui/button";
import { AffixInput, Field, inputClasses } from "@/components/ui/field";
import { FormAlert } from "@/components/ui/form-alert";
import { FormSection } from "@/components/ui/section";
import { formatMoney } from "@/lib/format";
import { useFormAction } from "@/lib/use-form-action";
import type { FormState } from "@/server/form-state";
import { createRentalAction } from "../../actions";

/** « Réserver » un article : location seule, sur une période. */
export function RentalForm({
  itemId,
  units,
  dailyRateCents,
  depositCents,
  defaults,
  customer,
}: {
  itemId: string;
  units: number;
  dailyRateCents: number | null;
  depositCents: number | null;
  defaults: { startDate: string; endDate: string };
  customer?: CustomerDefaults;
}) {
  const { state, onSubmit, pending } = useFormAction<FormState>(
    createRentalAction.bind(null, itemId),
    {},
  );
  const errors = state.fieldErrors ?? {};
  const [period, setPeriod] = useState({
    startDate: defaults.startDate,
    startTime: "09:00",
    endDate: defaults.endDate,
    endTime: "18:00",
  });
  const [quantity, setQuantity] = useState("1");
  const startsAt = new Date(`${period.startDate}T${period.startTime}`);
  const endsAt = new Date(`${period.endDate}T${period.endTime}`);
  const valid =
    !Number.isNaN(startsAt.getTime()) && !Number.isNaN(endsAt.getTime()) && endsAt > startsAt;
  const days = valid ? rentalDays(startsAt, endsAt) : 0;
  const count = Math.max(1, Number(quantity) || 1);
  const set = (key: keyof typeof period) => (event: { target: { value: string } }) =>
    setPeriod((current) => ({ ...current, [key]: event.target.value }));

  return (
    <form onSubmit={onSubmit} className="flex max-w-[768px] flex-col gap-10 px-4 py-8 sm:px-10">
      {state.error && <FormAlert>{state.error}</FormAlert>}
      <FormSection number={1} title="Période">
        <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_140px]">
          <Field label="Départ" required error={errors.startsAt}>
            {(field) => (
              <AffixInput
                {...field}
                type="date"
                name="startDate"
                required
                value={period.startDate}
                onChange={set("startDate")}
              />
            )}
          </Field>
          <Field label="Heure">
            {(field) => (
              <input
                {...field}
                type="time"
                name="startTime"
                required
                value={period.startTime}
                onChange={set("startTime")}
                className={inputClasses("md", "none")}
              />
            )}
          </Field>
          <Field label="Retour" required error={errors.endsAt}>
            {(field) => (
              <AffixInput
                {...field}
                type="date"
                name="endDate"
                required
                value={period.endDate}
                onChange={set("endDate")}
              />
            )}
          </Field>
          <Field label="Heure">
            {(field) => (
              <input
                {...field}
                type="time"
                name="endTime"
                required
                value={period.endTime}
                onChange={set("endTime")}
                className={inputClasses("md", "none")}
              />
            )}
          </Field>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            label="Exemplaires"
            required
            error={errors.quantity}
            hint={
              <p className="text-[13px] font-medium text-ink-muted">
                {units} exemplaire{units > 1 ? "s" : ""} en service
              </p>
            }
          >
            {(field) => (
              <AffixInput
                {...field}
                name="quantity"
                inputMode="numeric"
                required
                value={quantity}
                onChange={(event) => setQuantity(event.target.value.replace(/\D/g, ""))}
                suffix="ex."
                mono
              />
            )}
          </Field>
        </div>
        <p className="text-sm font-semibold text-ink">
          {!valid
            ? "Le retour doit être après le départ."
            : dailyRateCents === null
              ? `${days} jour${days > 1 ? "s" : ""} · pas de tarif défini : location gratuite.`
              : `${days} jour${days > 1 ? "s" : ""} × ${count} ex. × ${formatMoney(dailyRateCents)} = ${formatMoney(dailyRateCents * days * count)}`}
          {depositCents !== null && valid && (
            <span className="font-medium text-ink-muted">
              {" "}
              · caution {formatMoney(depositCents * count)}
            </span>
          )}
        </p>
      </FormSection>

      <FormSection number={2} title="Client">
        <CustomerFields customer={customer} errors={errors} />
        <p className="text-[13px] font-medium text-ink-muted">
          La location est confirmée d'office et les exemplaires sont bloqués sur la période. Toute
          journée entamée est due.
        </p>
      </FormSection>

      <div>
        <Button type="submit" arrow pending={pending} disabled={!valid}>
          {pending ? "Enregistrement…" : "Enregistrer la location"}
        </Button>
      </div>
    </form>
  );
}
