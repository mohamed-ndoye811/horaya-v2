"use client";

import type { CustomFieldDefinition } from "@horaya/core";
import { type FormEvent, type ReactNode, useState } from "react";
import { brandButtonClasses } from "@/components/public/public-chrome";
import { Checkbox, Field, inputClasses, textareaClasses } from "@/components/ui/field";
import { FormAlert } from "@/components/ui/form-alert";
import { ArrowRight } from "@/components/ui/icons";
import { FormSection } from "@/components/ui/section";
import { Select } from "@/components/ui/select";
import { cn } from "@/lib/cn";
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

/** Résumé d'un participant replié : nom puis réponses aux champs personnalisés. */
function participantSummary(
  fieldset: HTMLFieldSetElement,
  index: number,
  fields: CustomFieldDefinition[],
) {
  const value = (name: string) => {
    const element = fieldset.elements.namedItem(`p${index}.${name}`);
    if (element instanceof HTMLInputElement && element.type === "checkbox") {
      return element.checked ? (fields.find((field) => field.key === name)?.label ?? "") : "";
    }
    return element instanceof HTMLInputElement || element instanceof HTMLSelectElement
      ? element.value.trim()
      : "";
  };
  const name = [value("firstName"), value("lastName")].filter(Boolean).join(" ");
  return [name, ...fields.map((field) => value(field.key))].filter(Boolean).join(" · ");
}

/**
 * Participants 2 et suivants : repliés en une ligne (nom et réponses) avec « Modifier »,
 * dépliés pour la saisie. Les champs restent dans le formulaire une fois repliés.
 */
function ExtraParticipant({
  index,
  customFields,
  errors,
}: {
  index: number;
  customFields: CustomFieldDefinition[];
  errors: Record<string, string>;
}) {
  const hasError = Object.keys(errors).some((key) => key.startsWith(`p${index}.`));
  const [open, setOpen] = useState(false);
  const [summary, setSummary] = useState("");
  const expanded = open || hasError;
  const panelId = `participant-${index}`;
  return (
    <fieldset
      onInput={(event: FormEvent<HTMLFieldSetElement>) =>
        setSummary(participantSummary(event.currentTarget, index, customFields))
      }
      onChange={(event: FormEvent<HTMLFieldSetElement>) =>
        setSummary(participantSummary(event.currentTarget, index, customFields))
      }
      className="flex flex-col gap-3 rounded-[18px] border-[1.5px] border-dashed border-line px-[18px] py-3.5"
    >
      <legend className="sr-only">Participant {index + 1}</legend>
      <div className="flex items-center justify-between gap-4">
        <div className="flex min-w-0 flex-col gap-0.5">
          <span className="text-sm font-bold leading-[18px] text-ink">Participant {index + 1}</span>
          <span className="truncate text-[13px] leading-[18px] text-ink-subtle">
            {summary || "Facultatif : tu peux compléter plus tard."}
          </span>
        </div>
        <button
          type="button"
          aria-expanded={expanded}
          aria-controls={panelId}
          onClick={() => setOpen(!expanded)}
          className="flex h-9 shrink-0 items-center rounded-full bg-bg px-4 text-[13px] font-bold text-ink transition-colors hover:bg-line"
        >
          {expanded ? "Fermer" : summary ? "Modifier" : "Compléter"}
        </button>
      </div>
      <div id={panelId} hidden={!expanded} className="auth-fields grid gap-3 sm:grid-cols-2">
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
  );
}

/** Maquette 5.3 : participants (le premier, c'est toi), paiement, puis la barre de confirmation. */
export function BookingForm({
  slug,
  eventSlug,
  linkSlug,
  seats,
  customFields,
  workspaceName,
  submitLabel,
  summary,
  recap,
  payment,
}: {
  slug: string;
  eventSlug: string;
  /** Lien calendrier par lequel arrive le visiteur (vaut invitation). */
  linkSlug: string | null;
  seats: number;
  customFields: CustomFieldDefinition[];
  workspaceName: string;
  submitLabel: string;
  summary: ReactNode;
  /** Barre du bas : « 2 places · 70 € » et « 21 € d'acompte maintenant ». */
  recap: { main: string; extra?: string };
  /** Paiement en ligne juste après (tout ou l'acompte). */
  payment: {
    kind: "stripe" | "link";
    organization: string;
    due: string;
    deposit: boolean;
    rest: string;
  } | null;
}) {
  const { state, onSubmit, pending } = useFormAction<FormState>(
    createPublicBookingAction.bind(null, slug, eventSlug, linkSlug, seats),
    {},
  );
  const errors = state.fieldErrors ?? {};
  const terms = (
    <div className="flex flex-col gap-2">
      <Checkbox
        name="terms"
        required
        label={`J'accepte les conditions de réservation et la politique d'annulation de ${workspaceName}.`}
      />
      {errors.terms && <p className="text-[13px] font-semibold text-danger">{errors.terms}</p>}
    </div>
  );

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4 lg:flex-row lg:items-start">
      <div className="flex min-w-0 flex-1 flex-col gap-4">
        {state.error && <FormAlert>{state.error}</FormAlert>}
        <FormSection number={1} title={`Participant${seats > 1 ? "s" : ""} · ${seats}`}>
          <div className="auth-fields flex flex-col gap-3.5 rounded-[18px] bg-field p-[18px]">
            <p className="text-sm font-bold leading-[18px] text-ink">Participant 1 · toi</p>
            <div className="grid gap-3 sm:grid-cols-2">
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
          </div>
          {Array.from({ length: seats - 1 }, (_, offset) => offset + 1).map((index) => (
            <ExtraParticipant
              key={index}
              index={index}
              customFields={customFields}
              errors={errors}
            />
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

        {payment ? (
          <FormSection number={2} title="Paiement">
            <div className="flex items-start gap-3.5 rounded-[18px] bg-field px-[18px] py-4">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-[var(--brand)] text-[var(--on-brand)]">
                <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
                  <path
                    d={
                      payment.kind === "stripe"
                        ? "M3 6h18v12H3zM3 10h18"
                        : "M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"
                    }
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.75"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </span>
              <p className="text-sm leading-[21px] text-ink/85">
                {payment.kind === "stripe"
                  ? payment.deposit
                    ? `Tu règles l'acompte de ${payment.due} par carte sur la page sécurisée de Stripe ; le reste (${payment.rest}) sur place.`
                    : `Tu règles ${payment.due} par carte sur la page sécurisée de Stripe, juste après.`
                  : `Juste après ta réservation, tu règles ${payment.deposit ? `l'acompte de ${payment.due}` : payment.due} via le lien de paiement de ${payment.organization}.${payment.deposit ? ` Le reste (${payment.rest}) sur place.` : ""} ${payment.organization} confirme ensuite la réception.`}
              </p>
            </div>
            {terms}
          </FormSection>
        ) : (
          <div className="rounded-3xl bg-surface p-5 sm:p-6">{terms}</div>
        )}

        <div className="flex flex-col gap-3 rounded-[28px] bg-ink p-2.5 sm:flex-row sm:items-center sm:justify-between sm:rounded-full sm:pl-6">
          <p className="px-3 pt-1 text-sm leading-[18px] text-notch-idle sm:p-0">
            <span className="font-semibold text-on-ink">{recap.main}</span>
            {recap.extra && ` · ${recap.extra}`}
          </p>
          <button
            type="submit"
            disabled={pending}
            aria-busy={pending}
            className={cn(brandButtonClasses, "h-12 px-6 text-[15px] disabled:opacity-70")}
          >
            {pending ? "Un instant…" : submitLabel}
            {!pending && <ArrowRight />}
          </button>
        </div>
      </div>

      <aside className="order-first flex w-full shrink-0 flex-col overflow-hidden rounded-3xl bg-surface lg:sticky lg:top-[62px] lg:order-none lg:w-[400px]">
        {summary}
      </aside>
    </form>
  );
}
