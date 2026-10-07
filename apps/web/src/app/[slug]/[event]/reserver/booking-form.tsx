"use client";

import type { CustomFieldDefinition } from "@horaya/core";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox, Field, inputClasses, textareaClasses } from "@/components/ui/field";
import { FormAlert } from "@/components/ui/form-alert";
import { FormSection } from "@/components/ui/section";
import { Select } from "@/components/ui/select";
import { useFormAction } from "@/lib/use-form-action";
import type { FormState } from "@/server/form-state";
import { createPublicBookingAction } from "../../actions";

function CustomField({
  field,
  index,
  error,
}: {
  field: CustomFieldDefinition;
  index: number;
  error?: string;
}) {
  const name = `p${index}.${field.key}`;
  if (field.type === "checkbox") return <Checkbox name={name} label={field.label} />;
  return (
    <Field label={field.label} required={field.required && index === 0} error={error}>
      {(props) =>
        field.type === "select" ? (
          <Select {...props} name={name} defaultValue={field.options?.[0] ?? ""}>
            {(field.options ?? []).map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </Select>
        ) : (
          <input
            {...props}
            name={name}
            maxLength={500}
            required={field.required && index === 0}
            className={inputClasses()}
          />
        )
      }
    </Field>
  );
}

/** Écran 18 : participants (le premier, c'est toi), puis conditions et confirmation. */
export function BookingForm({
  slug,
  eventSlug,
  seats,
  customFields,
  workspaceName,
  submitLabel,
  summary,
  payment,
}: {
  slug: string;
  eventSlug: string;
  seats: number;
  customFields: CustomFieldDefinition[];
  workspaceName: string;
  submitLabel: string;
  summary: ReactNode;
  /** Paiement en ligne juste après (tout ou l'acompte). */
  payment: { due: string; deposit: boolean; rest: string } | null;
}) {
  const { state, onSubmit, pending } = useFormAction<FormState>(
    createPublicBookingAction.bind(null, slug, eventSlug, seats),
    {},
  );
  const errors = state.fieldErrors ?? {};

  return (
    <form
      onSubmit={onSubmit}
      className="flex flex-col gap-10 px-5 pt-8 pb-16 sm:px-16 sm:pt-12 lg:flex-row lg:items-start lg:gap-14"
    >
      <div className="flex min-w-0 flex-1 flex-col gap-9">
        {state.error && <FormAlert>{state.error}</FormAlert>}
        <FormSection number={1} title={`Participant${seats > 1 ? "s" : ""} · ${seats}`}>
          <p className="text-[15px] font-extrabold text-ink">Participant 1 · toi</p>
          <div className="grid gap-3 sm:grid-cols-[1fr_1fr_1.4fr]">
            <Field label="Prénom" required error={errors["customer.firstName"]}>
              {(field) => (
                <input
                  {...field}
                  name="firstName"
                  required
                  maxLength={60}
                  autoComplete="given-name"
                  className={inputClasses()}
                />
              )}
            </Field>
            <Field label="Nom" required error={errors["customer.lastName"]}>
              {(field) => (
                <input
                  {...field}
                  name="lastName"
                  required
                  maxLength={60}
                  autoComplete="family-name"
                  className={inputClasses()}
                />
              )}
            </Field>
            <Field label="E-mail" required error={errors["customer.email"]}>
              {(field) => (
                <input
                  {...field}
                  type="email"
                  name="email"
                  required
                  autoComplete="email"
                  className={inputClasses()}
                />
              )}
            </Field>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Téléphone">
              {(field) => (
                <input
                  {...field}
                  type="tel"
                  name="phone"
                  maxLength={30}
                  autoComplete="tel"
                  className={inputClasses()}
                />
              )}
            </Field>
            <Field label="Entreprise">
              {(field) => (
                <input
                  {...field}
                  name="company"
                  maxLength={120}
                  autoComplete="organization"
                  className={inputClasses()}
                />
              )}
            </Field>
            {customFields.map((field) => (
              <CustomField
                key={field.key}
                field={field}
                index={0}
                error={errors[`p0.${field.key}`]}
              />
            ))}
          </div>
          {Array.from({ length: seats - 1 }, (_, offset) => offset + 1).map((index) => (
            <fieldset
              key={index}
              className="flex flex-col gap-3 border-[1.5px] border-ink-subtle bg-surface px-4 py-3.5"
            >
              <legend className="sr-only">Participant {index + 1}</legend>
              <p className="flex flex-wrap items-baseline justify-between gap-2">
                <span className="text-[15px] font-extrabold text-ink">Participant {index + 1}</span>
                <span className="text-[13px] font-medium text-ink-muted">
                  Facultatif : tu peux compléter plus tard.
                </span>
              </p>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Prénom" error={errors[`p${index}.firstName`]}>
                  {(field) => (
                    <input
                      {...field}
                      name={`p${index}.firstName`}
                      maxLength={60}
                      className={inputClasses()}
                    />
                  )}
                </Field>
                <Field label="Nom" error={errors[`p${index}.lastName`]}>
                  {(field) => (
                    <input
                      {...field}
                      name={`p${index}.lastName`}
                      maxLength={60}
                      className={inputClasses()}
                    />
                  )}
                </Field>
                {customFields.map((field) => (
                  <CustomField key={field.key} field={field} index={index} />
                ))}
              </div>
            </fieldset>
          ))}
          <Field label="Un mot pour l'organisateur">
            {(field) => (
              <textarea
                {...field}
                name="customerMessage"
                rows={2}
                maxLength={1000}
                className={textareaClasses()}
              />
            )}
          </Field>
        </FormSection>

        {payment && (
          <section className="flex flex-col gap-4">
            <div className="flex items-baseline justify-between gap-3 border-b-2 border-ink pb-2.5">
              <h2 className="flex items-baseline gap-3">
                <span className="font-mono text-label font-semibold tracking-[0.055em] text-ink-muted">
                  02
                </span>
                <span className="font-section text-section leading-7 text-ink">Paiement</span>
              </h2>
              <span className="font-mono text-[11px] font-semibold uppercase tracking-[0.5px] text-ink-muted">
                Sécurisé par Stripe
              </span>
            </div>
            <div className="flex items-center gap-3 border-[1.5px] border-ink-subtle bg-surface px-4 py-4">
              <svg
                width="22"
                height="16"
                viewBox="0 0 22 16"
                aria-hidden="true"
                className="shrink-0 text-ink-muted"
              >
                <rect
                  x="1"
                  y="1"
                  width="20"
                  height="14"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.6"
                />
                <path d="M1 5H21" stroke="currentColor" strokeWidth="2" />
              </svg>
              <p className="text-[15px] font-medium leading-5 text-ink">
                {payment.deposit
                  ? `Tu règles l'acompte de ${payment.due} par carte sur la page sécurisée de Stripe ; le reste (${payment.rest}) sur place.`
                  : `Tu règles ${payment.due} par carte sur la page sécurisée de Stripe, juste après.`}
              </p>
            </div>
          </section>
        )}

        <div className="flex flex-col gap-2">
          <Checkbox
            name="terms"
            required
            label={`J'accepte les conditions de réservation et la politique d'annulation de ${workspaceName}`}
          />
          {errors.terms && <p className="text-[13px] font-semibold text-danger">{errors.terms}</p>}
        </div>
      </div>

      <aside className="flex w-full shrink-0 flex-col border-2 border-ink bg-surface lg:sticky lg:top-6 lg:w-[400px]">
        {summary}
        <div className="px-6 pt-4 pb-6">
          <Button type="submit" size="lg" pending={pending} arrow className="w-full">
            {submitLabel}
          </Button>
        </div>
      </aside>
    </form>
  );
}
