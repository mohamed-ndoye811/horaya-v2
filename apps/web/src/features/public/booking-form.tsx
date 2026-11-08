import { type EquipmentOffer, type EventTypeField, fieldsOfScope } from "@horaya/core";
import { type FormEvent, type ReactNode, useState } from "react";
import { FieldInputs } from "@/components/app/field-inputs";
import { Collapse } from "@/components/motion/collapse";
import { Swap } from "@/components/motion/swap";
import { EquipmentChoices } from "@/components/public/equipment-choices";
import { Button } from "@/components/ui/button";
import { Checkbox, Field, FieldError, inputClasses, textareaClasses } from "@/components/ui/field";
import { FormAlert } from "@/components/ui/form-alert";
import { FormSection } from "@/components/ui/section";
import { createPublicBookingAction } from "@/functions/public";
import { cn } from "@/lib/cn";
import { formatFieldValue, rawFieldValues } from "@/lib/fields";
import { useFormAction } from "@/lib/use-form-action";
import type { FormState } from "@/server/form-state";
import { BookingOptions, type PriceChoice, SeatPrice } from "./price-choice";

/** Résumé d'un participant replié : nom puis réponses. */
function participantSummary(form: HTMLFormElement, index: number, fields: EventTypeField[]) {
  const data = new FormData(form);
  const name = [data.get(`p${index}.firstName`), data.get(`p${index}.lastName`)]
    .map((value) => String(value ?? "").trim())
    .filter(Boolean)
    .join(" ");
  const raw = rawFieldValues(data, `p${index}.`);
  const answers = fields.map((field) => {
    const value = raw[field.key];
    if (value === null || value === undefined || value === "") return "";
    if (Array.isArray(value)) return value.join(", ");
    return field.type === "boolean" || field.type === "acceptance"
      ? `${field.label} : ${value === "true" || value === "on" ? "oui" : "non"}`
      : formatFieldValue(field, value as string);
  });
  return [name, ...answers].filter(Boolean).join(" · ");
}

/**
 * Participants 2 et suivants : repliés en une ligne (nom et réponses) avec « Modifier »,
 * dépliés pour la saisie. Les champs restent dans le formulaire une fois repliés. Avec des
 * questions requises, le bloc reste ouvert (un champ requis caché bloquerait l'envoi).
 */
function ExtraParticipant({
  index,
  fields,
  errors,
  price,
}: {
  index: number;
  fields: EventTypeField[];
  errors: Record<string, string>;
  price: PriceChoice | null;
}) {
  const hasError = Object.keys(errors).some(
    (key) => key.startsWith(`p${index}.`) || key.startsWith(`participants.${index}.`),
  );
  const mandatory = fields.some((field) => field.required);
  const [open, setOpen] = useState(mandatory);
  const [summary, setSummary] = useState("");
  const expanded = open || hasError;
  const panelId = `participant-${index}`;
  const update = (event: FormEvent<HTMLFieldSetElement>) => {
    const form = event.currentTarget.form;
    if (form) setSummary(participantSummary(form, index, fields));
  };
  return (
    <fieldset
      onInput={update}
      onChange={update}
      className="flex flex-col gap-3 rounded-[18px] border-[1.5px] border-dashed border-line px-[18px] py-3.5"
    >
      <legend className="sr-only">Participant {index + 1}</legend>
      <div className="flex items-center justify-between gap-4">
        <div className="flex min-w-0 flex-col gap-0.5">
          <span className="text-sm font-bold leading-[18px] text-ink">Participant {index + 1}</span>
          <span className="truncate text-[13px] leading-[18px] text-ink-subtle">
            {summary ||
              (mandatory
                ? "Quelques questions pour cette place."
                : "Facultatif : tu peux compléter plus tard.")}
          </span>
        </div>
        {!mandatory && (
          <Button
            variant="soft"
            size="xs"
            aria-expanded={expanded}
            aria-controls={panelId}
            onClick={() => setOpen(!expanded)}
          >
            <Swap value={expanded ? "fermer" : summary ? "modifier" : "completer"}>
              {expanded ? "Fermer" : summary ? "Modifier" : "Compléter"}
            </Swap>
          </Button>
        )}
      </div>
      {price && <SeatPrice choice={price} seat={index} />}
      <Collapse keepMounted open={expanded}>
        <div id={panelId} className="auth-fields flex flex-col gap-3">
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
          </div>
          <FieldInputs
            fields={fields}
            prefix={`p${index}.`}
            errorPrefix={`participants.${index}.answers.`}
            errors={errors}
            className="grid gap-3 sm:grid-cols-2"
          />
        </div>
      </Collapse>
    </fieldset>
  );
}

/** Maquette 5.3 : participants (le premier, c'est toi), paiement, puis la barre de confirmation. */
export function BookingForm({
  slug,
  eventSlug,
  linkSlug,
  seats,
  fields,
  workspaceName,
  submitLabel,
  summary,
  recap,
  payment,
  prefill,
  pass = null,
  equipment = [],
  action,
  enrollment = false,
  price = null,
  giftCards = true,
}: {
  slug: string;
  eventSlug: string;
  /** Lien calendrier par lequel arrive le visiteur (vaut invitation). */
  linkSlug: string | null;
  seats: number;
  /** Champs de l'événement : on en tire « Ce que tu demandes » (une fois, par participant). */
  fields: EventTypeField[];
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
    /** Le reste se règle plus tard en ligne (sinon sur place). */
    restLater?: boolean;
  } | null;
  /** Espace client connecté : son profil remplit le participant 1. */
  prefill: { firstName: string; lastName: string; email: string; phone: string } | null;
  /** Lot 31 : client connecté avec une carte de séances utilisable pour ces places. */
  pass?: { id: string; name: string; balance: number; sessions: number } | null;
  /** Module Matériel avancé : ce que l'élève réserve ou choisit avec sa place. */
  equipment?: EquipmentOffer[];
  /** Autre envoi que la réservation à la séance (inscription à toute la série). */
  action?: (previous: FormState, form: FormData) => Promise<FormState>;
  /** Inscription à la série : une seule personne, sans entreprise ni message. */
  enrollment?: boolean;
  /** Tarifs et options (lot 35) : un tarif par participant, options. */
  price?: PriceChoice | null;
  /** Le type accepte les bons cadeaux (module « Moyens acceptés »). */
  giftCards?: boolean;
}) {
  const { state, onSubmit, pending } = useFormAction<FormState>(
    action ?? createPublicBookingAction.bind(null, slug, eventSlug, linkSlug, seats),
    {},
  );
  const errors = state.fieldErrors ?? {};
  const bookingFields = fieldsOfScope(fields, "booking");
  const participantFields = fieldsOfScope(fields, "participant");
  const terms = (
    <div className="flex flex-col gap-2">
      <Checkbox
        name="terms"
        required
        label={`J'accepte les conditions ${enrollment ? "d'inscription" : "de réservation et la politique d'annulation"} de ${workspaceName}.`}
      />
      {errors.terms && <FieldError>{errors.terms}</FieldError>}
    </div>
  );
  const passChoice = pass && (
    <div className="rounded-[18px] bg-field px-[18px] py-4">
      <Checkbox
        name="passId"
        value={pass.id}
        defaultChecked
        label={`Payer avec ma carte « ${pass.name} » : ${pass.sessions} séance${pass.sessions > 1 ? "s" : ""} sur les ${pass.balance} qui restent, rien d'autre à régler`}
      />
    </div>
  );

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4 lg:flex-row lg:items-start">
      <div className="reveal-group flex min-w-0 flex-1 flex-col gap-4">
        {state.error && <FormAlert>{state.error}</FormAlert>}
        <FormSection number={1} title={`Participant${seats > 1 ? "s" : ""} · ${seats}`}>
          <div className="auth-fields flex flex-col gap-3.5 rounded-[18px] bg-field p-[18px]">
            <p className="text-sm font-bold leading-[18px] text-ink">Participant 1 · toi</p>
            {price && <SeatPrice choice={price} seat={0} />}
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Prénom" required error={errors["customer.firstName"]}>
                {(field) => (
                  <input
                    {...field}
                    name="firstName"
                    defaultValue={prefill?.firstName}
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
                    defaultValue={prefill?.lastName}
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
                    defaultValue={prefill?.email}
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
                    defaultValue={prefill?.phone}
                    maxLength={30}
                    autoComplete="tel"
                    className={inputClasses()}
                  />
                )}
              </Field>
              {!enrollment && (
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
              )}
            </div>
            <FieldInputs
              fields={participantFields}
              prefix="p0."
              errorPrefix="participants.0.answers."
              errors={errors}
              className="grid gap-3 sm:grid-cols-2"
            />
          </div>
          {bookingFields.length > 0 && (
            <div className="flex flex-col gap-3.5 rounded-[18px] bg-field p-[18px]">
              <p className="text-sm font-bold leading-[18px] text-ink">
                {seats > 1 ? "Pour ta réservation" : "Quelques questions"}
              </p>
              <FieldInputs
                fields={bookingFields}
                prefix="a."
                errorPrefix="answers."
                errors={errors}
                className="grid gap-3 sm:grid-cols-2"
              />
            </div>
          )}
          <EquipmentChoices
            offers={equipment}
            seats={seats}
            errors={errors}
            linked={price?.linked ?? {}}
            optionNames={Object.fromEntries(
              (price?.options ?? []).flatMap((option) =>
                option.needId ? [[option.needId, option.name]] : [],
              ),
            )}
          />
          {Array.from({ length: seats - 1 }, (_, offset) => offset + 1).map((index) => (
            <ExtraParticipant
              key={index}
              index={index}
              fields={participantFields}
              errors={errors}
              price={price}
            />
          ))}
          {price && (
            <>
              <input type="hidden" name="price" value={JSON.stringify(price.selection)} />
              <BookingOptions choice={price} />
            </>
          )}
          {!enrollment && (
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
          )}
        </FormSection>

        {giftCards && (
          <FormSection number={2} title="Bon cadeau">
            <Field
              label="J'ai un bon cadeau"
              error={errors.giftCardCode}
              hint={
                <p className="text-[13px] font-medium text-ink-muted">
                  Facultatif. Le montant est déduit du prix, le reste du solde est conservé.
                </p>
              }
            >
              {(field) => (
                <input
                  {...field}
                  name="giftCardCode"
                  maxLength={40}
                  autoComplete="off"
                  autoCapitalize="characters"
                  spellCheck={false}
                  placeholder="TERRE-8K2F7M3P"
                  className={cn(inputClasses(), "font-mono uppercase placeholder:normal-case")}
                />
              )}
            </Field>
          </FormSection>
        )}

        {payment ? (
          <FormSection number={giftCards ? 3 : 2} title="Paiement">
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
                    ? `Tu règles l'acompte de ${payment.due} par carte sur la page sécurisée de Stripe ; le reste (${payment.rest}) ${payment.restLater ? "plus tard, en ligne" : "sur place"}.`
                    : `Tu règles ${payment.due} par carte sur la page sécurisée de Stripe, juste après.`
                  : `Juste après ta ${enrollment ? "inscription" : "réservation"}, tu règles ${payment.deposit ? `l'acompte de ${payment.due}` : payment.due} via le lien de paiement de ${payment.organization}.${payment.deposit ? ` Le reste (${payment.rest}) ${payment.restLater ? "plus tard, avec le même lien" : "sur place"}.` : ""} ${payment.organization} confirme ensuite la réception.`}
              </p>
            </div>
            {passChoice}
            {terms}
          </FormSection>
        ) : (
          <div className="flex flex-col gap-4 rounded-3xl bg-surface p-5 sm:p-6">
            {passChoice}
            {terms}
          </div>
        )}

        <div className="flex flex-col gap-3 rounded-[28px] bg-ink p-2.5 sm:flex-row sm:items-center sm:justify-between sm:rounded-full sm:pl-6">
          <p className="px-3 pt-1 text-sm leading-[18px] text-notch-idle sm:p-0">
            <span className="font-semibold text-on-ink">{recap.main}</span>
            {recap.extra && ` · ${recap.extra}`}
          </p>
          <Button type="submit" variant="brand" pending={pending} arrow>
            {pending ? "Un instant…" : submitLabel}
          </Button>
        </div>
      </div>

      <aside className="order-first flex w-full animate-rise shrink-0 flex-col overflow-hidden rounded-3xl bg-surface lg:sticky lg:top-[62px] lg:order-none lg:w-[400px]">
        {summary}
      </aside>
    </form>
  );
}
