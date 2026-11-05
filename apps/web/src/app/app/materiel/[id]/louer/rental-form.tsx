"use client";

import { rentalDays } from "@horaya/core";
import { useState } from "react";
import { type CustomerDefaults, CustomerFields } from "@/components/app/customer-fields";
import { Button } from "@/components/ui/button";
import { AffixInput, Field, inputClasses } from "@/components/ui/field";
import { FormAlert } from "@/components/ui/form-alert";
import { BoxIcon } from "@/components/ui/icons";
import { FormSection } from "@/components/ui/section";
import { formatMoney } from "@/lib/format";
import { useFormAction } from "@/lib/use-form-action";
import type { FormState } from "@/server/form-state";
import { createRentalAction } from "../../actions";

/** « Réserver » un article : location seule, sur une période. */
export function RentalForm({
  itemId,
  name,
  reference,
  units,
  dailyRateCents,
  depositCents,
  defaults,
  customer,
}: {
  itemId: string;
  name: string;
  reference: string;
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
  const dayMonth = (date: string) =>
    new Date(`${date}T12:00`).toLocaleDateString("fr-FR", { day: "numeric", month: "long" });
  const periodLabel = !valid
    ? "—"
    : period.startDate === period.endDate
      ? dayMonth(period.startDate)
      : `${dayMonth(period.startDate).replace(/ \S+$/, (month) => (period.startDate.slice(0, 7) === period.endDate.slice(0, 7) ? "" : month))} → ${dayMonth(period.endDate)}`;
  const totalCents = dailyRateCents === null ? 0 : dailyRateCents * days * count;
  const set = (key: keyof typeof period) => (event: { target: { value: string } }) =>
    setPeriod((current) => ({ ...current, [key]: event.target.value }));

  return (
    <form
      onSubmit={onSubmit}
      className="grid items-start gap-4 px-4 pb-4 xl:grid-cols-[minmax(0,1fr)_340px]"
    >
      <div className="flex min-w-0 flex-col gap-4">
        {state.error && <FormAlert>{state.error}</FormAlert>}
        <FormSection number={1} title="Période">
          <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_100px] xl:grid-cols-[minmax(0,1fr)_100px_minmax(0,1fr)_100px_150px]">
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
            <Field
              label="Exemplaires"
              required
              error={errors.quantity}
              hint={<p className="text-xs leading-4 text-ink-subtle">{units} en service</p>}
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
                />
              )}
            </Field>
          </div>
          <p className="flex items-center gap-2.5 rounded-2xl bg-field px-4 py-3 text-sm font-semibold leading-[18px] text-ink">
            <svg
              aria-hidden="true"
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#6b6b6b"
              strokeWidth="1.75"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="shrink-0"
            >
              <path d="M4 2v20l2-1 2 1 2-1 2 1 2-1 2 1 2-1 2 1V2l-2 1-2-1-2 1-2-1-2 1-2-1-2 1Z" />
              <path d="M8 8h8M8 12h8M8 16h5" />
            </svg>
            <span>
              {!valid
                ? "Le retour doit être après le départ."
                : dailyRateCents === null
                  ? `${days} jour${days > 1 ? "s" : ""} · pas de tarif défini : location gratuite.`
                  : `${days} jour${days > 1 ? "s" : ""} × ${count} ex. × ${formatMoney(dailyRateCents)} = ${formatMoney(dailyRateCents * days * count)}`}
              {depositCents !== null && valid && (
                <span className="font-normal text-ink-subtle">
                  {" "}
                  · caution {formatMoney(depositCents * count)}
                </span>
              )}
            </span>
          </p>
        </FormSection>

        <FormSection number={2} title="Client">
          <CustomerFields customer={customer} errors={errors} />
          <p className="text-xs leading-4 text-ink-subtle">
            La location est confirmée d'office et les exemplaires sont bloqués sur la période. Toute
            journée entamée est due.
          </p>
        </FormSection>
      </div>

      <aside className="flex flex-col gap-4 rounded-3xl bg-ink p-2 pb-5 xl:sticky xl:top-4">
        <div
          aria-hidden="true"
          className="flex h-[180px] items-center justify-center rounded-[18px] bg-white/5 text-white/40"
        >
          <BoxIcon size={48} />
        </div>
        <div className="flex flex-col gap-0.5 px-3.5">
          <p className="text-[17px] font-semibold leading-[22px] text-white">{name}</p>
          <p className="text-[13px] leading-[17px] text-[#9a9ea8]">
            Réf. {reference}
            {dailyRateCents !== null ? ` · ${formatMoney(dailyRateCents)} / jour` : ""}
          </p>
        </div>
        <dl className="mx-3.5 flex flex-col border-y border-white/10 py-2">
          {[
            ["Période", periodLabel],
            ["Exemplaire" + (count > 1 ? "s" : ""), `${count}`],
            ["Caution", depositCents === null ? "—" : formatMoney(depositCents * count)],
          ].map(([label, value]) => (
            <div key={label} className="flex items-center justify-between gap-4 py-1.5">
              <dt className="text-sm leading-[18px] text-[#9a9ea8]">{label}</dt>
              <dd className="text-sm font-semibold leading-[18px] text-white">{value}</dd>
            </div>
          ))}
        </dl>
        <div className="flex items-end justify-between px-3.5">
          <span className="pb-1.5 text-sm leading-[18px] text-[#9a9ea8]">Total</span>
          <span className="font-headline text-[40px] leading-[44px] tracking-[-0.03em] text-white">
            {valid ? formatMoney(totalCents).replace(/\s?€$/, "") : "—"}
            {valid && <span className="ml-1 text-lg font-light tracking-normal">€</span>}
          </span>
        </div>
        <div className="flex px-3.5 *:flex-1">
          <Button type="submit" variant="inverse" arrow pending={pending} disabled={!valid}>
            {pending ? "Enregistrement…" : "Enregistrer la location"}
          </Button>
        </div>
      </aside>
    </form>
  );
}
