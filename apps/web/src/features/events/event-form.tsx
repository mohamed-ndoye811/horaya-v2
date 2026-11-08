import {
  type EventTypeField,
  type FieldValues,
  fieldsOfScope,
  generateOccurrences,
} from "@horaya/core";
import { type ReactNode, useMemo, useState } from "react";
import { FieldInputs } from "@/components/app/field-inputs";
import { ActionBar } from "@/components/ui/action-bar";
import { CategorySwatch } from "@/components/ui/avatar";
import { ChoiceCards } from "@/components/ui/choice-cards";
import {
  AffixInput,
  Checkbox,
  Field,
  FieldError,
  inputClasses,
  textareaClasses,
} from "@/components/ui/field";
import { FormAlert } from "@/components/ui/form-alert";
import { CalendarIcon, Check, PinIcon } from "@/components/ui/icons";
import { FormSection } from "@/components/ui/section";
import { SegmentedControl } from "@/components/ui/segmented";
import { Select } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { saveEvent } from "@/functions/events";
import { cn } from "@/lib/cn";
import { parseCivilDate } from "@/lib/dates";
import { formatHour, formatWeekdayShort } from "@/lib/format";
import { parseEuroToCents } from "@/lib/money";
import { useFormAction } from "@/lib/use-form-action";
import { useInvalidMessage } from "@/lib/use-invalid-message";
import type { FormState } from "@/server/form-state";

export interface EventTypeOption {
  id: string;
  name: string;
  color: string;
  /** Champs du type (à la modification : ceux de l'événement, sa version du type). */
  fields: EventTypeField[];
  defaultDurationMinutes: number | null;
  defaultPriceCents: number | null;
  defaultCapacity: number | null;
  requiresApproval: boolean;
}

export interface EventFormValues {
  title: string;
  eventTypeId: string;
  description: string;
  startDate: string;
  startTime: string;
  endDate: string;
  endTime: string;
  locationName: string;
  onlineUrl: string;
  capacity: string;
  price: string;
  paymentMode: string;
  depositPercent: string;
  /** Lien de paiement propre à l'événement (sinon celui des paramètres). */
  paymentLinkUrl: string;
  requiresApproval: boolean;
  visibility: string;
  /** Points forts séparés par des virgules (« Déjeuner inclus, Accessible PMR »). */
  highlights: string;
}

const PAYMENT_OPTIONS = [
  { value: "free", label: "Gratuit", description: "Inscription seule" },
  { value: "online", label: "Paiement en ligne", description: "Lien de paiement" },
  { value: "deposit", label: "Acompte", description: "Le reste sur place" },
  { value: "on_site", label: "Sur place", description: "Espèces ou carte" },
];

const FREQUENCIES = [
  { value: "weekly:1", label: "Toutes les semaines" },
  { value: "weekly:2", label: "Toutes les 2 semaines" },
  { value: "monthly:1", label: "Tous les mois" },
  { value: "monthly:2", label: "Tous les 2 mois" },
  { value: "daily:1", label: "Tous les jours" },
];

/** Ajoute des minutes à une date + heure saisies (calcul naïf, sans fuseau : pour pré-remplir la fin). */
function shift(date: string, time: string, minutes: number): { date: string; time: string } | null {
  const day = parseCivilDate(date);
  const match = time.match(/^(\d{2}):(\d{2})$/);
  if (!day || !match) return null;
  const value = new Date(
    Date.UTC(day.year, day.month - 1, day.day, Number(match[1]), Number(match[2]) + minutes),
  );
  return {
    date: value.toISOString().slice(0, 10),
    time: value.toISOString().slice(11, 16),
  };
}

/** Écran 09 : création et modification d'un événement, aperçu public en direct. */
export function EventForm({
  eventId,
  types,
  initial,
  timeZone,
  formId,
  actions,
  fieldValues = {},
}: {
  eventId: string | null;
  types: EventTypeOption[];
  initial: EventFormValues;
  /** Valeurs de « Ce que tu décris » déjà saisies. */
  fieldValues?: FieldValues;
  timeZone: string;
  formId: string;
  /** Boutons de la barre noire du bas (enregistrer, publier), en variantes `inverse`. */
  actions: ReactNode;
}) {
  const { state, onSubmit } = useFormAction<FormState>(saveEvent.bind(null, eventId), {});
  const [values, setValues] = useState(initial);
  const [recurring, setRecurring] = useState(false);
  const [frequency, setFrequency] = useState("weekly:1");
  const [count, setCount] = useState("6");
  const countInvalid = useInvalidMessage();
  const errors = state.fieldErrors ?? {};
  const type = types.find((entry) => entry.id === values.eventTypeId);
  const described = fieldsOfScope(type?.fields ?? [], "event");
  const set = (patch: Partial<EventFormValues>) =>
    setValues((current) => ({ ...current, ...patch }));

  function changeType(id: string) {
    const next = types.find((entry) => entry.id === id);
    if (!next || eventId) return set({ eventTypeId: id });
    const end = next.defaultDurationMinutes
      ? shift(values.startDate, values.startTime, next.defaultDurationMinutes)
      : null;
    set({
      eventTypeId: id,
      requiresApproval: next.requiresApproval,
      ...(values.capacity === "" && next.defaultCapacity
        ? { capacity: String(next.defaultCapacity) }
        : {}),
      ...(values.price === "" && next.defaultPriceCents
        ? {
            price: (next.defaultPriceCents / 100).toFixed(2).replace(".", ","),
            paymentMode: values.paymentMode === "free" ? "on_site" : values.paymentMode,
          }
        : {}),
      ...(end ? { endDate: end.date, endTime: end.time } : {}),
    });
  }

  const start = useMemo(() => {
    const day = parseCivilDate(values.startDate);
    const time = values.startTime.match(/^(\d{2}):(\d{2})$/);
    if (!day || !time) return null;
    // Aperçu : l'heure saisie est celle de l'espace ; on l'affiche telle quelle.
    return new Date(Date.UTC(day.year, day.month - 1, day.day, Number(time[1]), Number(time[2])));
  }, [values.startDate, values.startTime]);

  const nextOccurrence = useMemo(() => {
    if (!recurring || !start) return null;
    const [freq, interval] = frequency.split(":");
    try {
      const dates = generateOccurrences(
        {
          frequency: freq as "weekly",
          interval: Number(interval),
          count: Math.max(2, Number(count) || 2),
        },
        start,
        "UTC",
      );
      return dates[1] ?? null;
    } catch {
      return null;
    }
  }, [recurring, start, frequency, count]);

  const priceCents = values.paymentMode === "free" ? 0 : parseEuroToCents(values.price);
  const checklist = [
    { label: "Informations", done: values.title.trim().length >= 2 && Boolean(type) },
    {
      label: "Date & lieu",
      done:
        Boolean(start && values.endDate && values.endTime) &&
        Boolean(values.locationName || values.onlineUrl),
    },
    {
      label: "Places & paiement",
      done:
        (values.paymentMode === "free" || priceCents > 0) &&
        (values.paymentMode !== "deposit" || values.depositPercent !== ""),
    },
  ];
  const ready = checklist.filter((item) => item.done).length;
  /*
   * Sous xl, la colonne de droite passe après tout le formulaire : la visibilité monte dans la
   * section 1. Deux exemplaires, un seul affiché : des radios de même nom formeraient un seul
   * groupe, et le serveur lit le premier `visibility` (celui de la section 1, toujours à jour).
   */
  const visibilityField = (name: string) => (
    <Field label="Visibilité" group>
      {() => (
        <SegmentedControl
          name={name}
          label="Visibilité"
          value={values.visibility}
          onChange={(visibility) => set({ visibility })}
          segments={[
            { value: "public", label: "Public" },
            { value: "invite_only", label: "Sur invitation" },
          ]}
        />
      )}
    </Field>
  );

  return (
    <form
      id={formId}
      onSubmit={onSubmit}
      className="grid gap-4 px-4 pb-4 xl:grid-cols-[minmax(0,1fr)_340px]"
    >
      <div className="flex min-w-0 flex-col gap-4">
        {state.error && <FormAlert>{state.error}</FormAlert>}

        <FormSection number={1} title="Informations">
          <Field label="Titre" required error={errors.title}>
            {(field) => (
              <input
                {...field}
                name="title"
                required
                maxLength={120}
                value={values.title}
                onChange={(event) => set({ title: event.target.value })}
                placeholder="Séminaire annuel"
                className={inputClasses()}
              />
            )}
          </Field>
          <Field label="Type d'événement" required error={errors.eventTypeId}>
            {(field) => (
              <Select
                {...field}
                name="eventTypeId"
                required
                disabled={Boolean(eventId)}
                value={values.eventTypeId}
                onChange={(event) => changeType(event.target.value)}
                leading={type ? <CategorySwatch color={type.color} size={12} /> : undefined}
              >
                <option value="" disabled>
                  Choisis un type
                </option>
                {types.map((entry) => (
                  <option key={entry.id} value={entry.id}>
                    {entry.name}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          <Field
            label="Description"
            aside={`${values.description.length} / 5000`}
            error={errors.description}
            hint={
              <p className="text-[13px] font-medium text-ink-muted">
                Visible sur la page publique de l'événement.
              </p>
            }
          >
            {(field) => (
              <textarea
                {...field}
                name="description"
                maxLength={5000}
                value={values.description}
                onChange={(event) => set({ description: event.target.value })}
                className={textareaClasses()}
              />
            )}
          </Field>
          <Field
            label="Points forts"
            error={errors.highlights}
            hint={
              <p className="text-[13px] font-medium text-ink-muted">
                Séparés par des virgules, 6 au maximum : ils s'affichent en étiquettes sur la page
                publique.
              </p>
            }
          >
            {(field) => (
              <input
                {...field}
                name="highlights"
                maxLength={500}
                value={values.highlights}
                onChange={(event) => set({ highlights: event.target.value })}
                placeholder="Déjeuner inclus, Accessible PMR, Aucun matériel à apporter"
                className={inputClasses()}
              />
            )}
          </Field>
          <div className="xl:hidden">{visibilityField("visibility")}</div>
        </FormSection>

        <FormSection number={2} title="Date & lieu">
          <div className="grid gap-4 sm:grid-cols-[1fr_128px] lg:grid-cols-[1fr_128px_1fr_128px]">
            <Field label="Début" required error={errors.startsAt}>
              {(field) => (
                <AffixInput
                  {...field}
                  type="date"
                  name="startDate"
                  required
                  value={values.startDate}
                  onChange={(event) => set({ startDate: event.target.value })}
                  leading={<CalendarIcon size={16} />}
                />
              )}
            </Field>
            <Field label="Heure">
              {(field) => (
                <AffixInput
                  {...field}
                  type="time"
                  name="startTime"
                  required
                  value={values.startTime}
                  onChange={(event) => set({ startTime: event.target.value })}
                  mono
                />
              )}
            </Field>
            <Field label="Fin" required error={errors.endsAt}>
              {(field) => (
                <AffixInput
                  {...field}
                  type="date"
                  name="endDate"
                  required
                  value={values.endDate}
                  onChange={(event) => set({ endDate: event.target.value })}
                  leading={<CalendarIcon size={16} />}
                />
              )}
            </Field>
            <Field label="Heure">
              {(field) => (
                <AffixInput
                  {...field}
                  type="time"
                  name="endTime"
                  required
                  value={values.endTime}
                  onChange={(event) => set({ endTime: event.target.value })}
                  mono
                />
              )}
            </Field>
          </div>

          {!eventId && (
            <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-line-soft bg-field px-4 py-4">
              <Switch
                name="recurring"
                checked={recurring}
                onChange={(event) => setRecurring(event.target.checked)}
                label="Événement récurrent"
                description={
                  recurring
                    ? nextOccurrence
                      ? `Prochaine occurrence : ${formatWeekdayShort(nextOccurrence, "UTC")} ${nextOccurrence.getUTCDate()} ${nextOccurrence.toLocaleDateString("fr-FR", { month: "long", timeZone: "UTC" })}`
                      : "Choisis une date de début"
                    : "Une seule date"
                }
              />
              {recurring && (
                <div className="flex flex-wrap items-center gap-3">
                  <input type="hidden" name="frequency" value={frequency.split(":")[0]} />
                  <input type="hidden" name="interval" value={frequency.split(":")[1]} />
                  <Select
                    variant="compact"
                    aria-label="Fréquence"
                    value={frequency}
                    onChange={(event) => setFrequency(event.target.value)}
                    className="w-52"
                  >
                    {FREQUENCIES.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </Select>
                  <label
                    className="flex items-center gap-2 text-sm font-semibold text-ink"
                    {...countInvalid.handlers}
                  >
                    <input
                      type="number"
                      name="count"
                      min={2}
                      max={104}
                      value={count}
                      onChange={(event) => setCount(event.target.value)}
                      className={cn(inputClasses("sm"), "w-20 font-mono")}
                    />
                    fois
                  </label>
                </div>
              )}
            </div>
          )}
          {(countInvalid.message ?? errors.recurrence) && (
            <FieldError>{countInvalid.message ?? errors.recurrence}</FieldError>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Lieu" error={errors.locationName}>
              {(field) => (
                <AffixInput
                  {...field}
                  name="locationName"
                  maxLength={200}
                  value={values.locationName}
                  onChange={(event) => set({ locationName: event.target.value })}
                  placeholder="445 rue de la Thèse, Puget-Ville"
                  leading={<PinIcon size={16} />}
                />
              )}
            </Field>
            <Field label="Lien de visio (si en ligne)" error={errors.onlineUrl}>
              {(field) => (
                <AffixInput
                  {...field}
                  type="url"
                  name="onlineUrl"
                  value={values.onlineUrl}
                  onChange={(event) => set({ onlineUrl: event.target.value })}
                  placeholder="https://…"
                />
              )}
            </Field>
          </div>
        </FormSection>

        <FormSection number={3} title="Places & paiement">
          <Field label="Mode de paiement" group error={errors.paymentMode}>
            {() => (
              <ChoiceCards
                name="paymentMode"
                label="Mode de paiement"
                value={values.paymentMode}
                onChange={(paymentMode) => set({ paymentMode })}
                options={PAYMENT_OPTIONS}
              />
            )}
          </Field>
          <div className="grid gap-4 sm:grid-cols-3">
            <Field
              label="Nombre de places"
              error={errors.capacity}
              hint={<p className="text-[13px] font-medium text-ink-muted">Vide = illimité.</p>}
            >
              {(field) => (
                <AffixInput
                  {...field}
                  name="capacity"
                  inputMode="numeric"
                  value={values.capacity}
                  onChange={(event) => set({ capacity: event.target.value.replace(/\D/g, "") })}
                  suffix="places"
                  mono
                />
              )}
            </Field>
            {values.paymentMode !== "free" && (
              <Field label="Prix par personne" required error={errors.priceCents}>
                {(field) => (
                  <AffixInput
                    {...field}
                    name="price"
                    inputMode="decimal"
                    value={values.price}
                    onChange={(event) => set({ price: event.target.value })}
                    suffix="€ TTC"
                    mono
                    placeholder="0,00"
                  />
                )}
              </Field>
            )}
            {values.paymentMode === "deposit" && (
              <Field label="Acompte" required error={errors.depositPercent}>
                {(field) => (
                  <AffixInput
                    {...field}
                    name="depositPercent"
                    inputMode="numeric"
                    value={values.depositPercent}
                    onChange={(event) =>
                      set({ depositPercent: event.target.value.replace(/\D/g, "") })
                    }
                    suffix="%"
                    mono
                  />
                )}
              </Field>
            )}
          </div>
          {(values.paymentMode === "online" || values.paymentMode === "deposit") && (
            <Field
              label="Lien de paiement"
              error={errors.paymentLinkUrl}
              hint={
                <p className="text-[13px] font-medium text-ink-muted">
                  Facultatif : sans lien ici, celui de Paramètres › Paiements est proposé au client.
                </p>
              }
            >
              {(field) => (
                <input
                  {...field}
                  type="url"
                  name="paymentLinkUrl"
                  maxLength={500}
                  value={values.paymentLinkUrl}
                  onChange={(event) => set({ paymentLinkUrl: event.target.value })}
                  placeholder="https://buy.stripe.com/…"
                  className={inputClasses()}
                />
              )}
            </Field>
          )}
          <Checkbox
            name="requiresApproval"
            checked={values.requiresApproval}
            onChange={(event) => set({ requiresApproval: event.target.checked })}
            label="Valider manuellement chaque réservation"
          />
        </FormSection>

        {described.length > 0 && (
          <FormSection
            number={4}
            title="Ce que tu décris"
            description={`Les informations d'un ${type?.name.toLowerCase() ?? "événement"}`}
          >
            <FieldInputs
              key={type?.id}
              fields={described}
              prefix="f."
              errorPrefix="fieldValues."
              defaults={fieldValues}
              errors={errors}
            />
          </FormSection>
        )}

        <ActionBar
          message={
            ready === checklist.length ? (
              <>
                <strong>Tout est prêt</strong> : tu peux publier.
              </>
            ) : (
              <>
                Il manque{" "}
                <strong>{checklist.find((item) => !item.done)?.label.toLowerCase()}</strong> pour
                publier.
              </>
            )
          }
        >
          {actions}
        </ActionBar>
      </div>

      <aside className="flex flex-col gap-4 xl:sticky xl:top-4 xl:self-start">
        <div className="flex flex-col overflow-hidden rounded-3xl bg-surface">
          <div
            className="flex h-[120px] flex-col justify-between p-4"
            style={{
              background: `linear-gradient(150deg, ${type?.color ?? "#111111"} 0%, color-mix(in srgb, ${type?.color ?? "#111111"} 70%, black) 100%)`,
            }}
          >
            <span className="text-[11px] font-bold uppercase tracking-[0.06em] text-white/80">
              Aperçu public
            </span>
            <p className="font-headline text-2xl leading-7 text-white">
              {values.title || "Titre de l'événement"}
            </p>
          </div>
          <div className="flex flex-col gap-1 px-4 py-3.5">
            <p className="text-[15px] font-semibold text-ink">
              {start
                ? `${formatWeekdayShort(start, "UTC")} ${start.getUTCDate()} ${start.toLocaleDateString("fr-FR", { month: "long", timeZone: "UTC" })} · ${formatHour(start, "UTC")}`
                : "Date à choisir"}
            </p>
            <p className="text-[13px] text-ink-muted">
              {[
                values.locationName || (values.onlineUrl ? "En ligne" : null),
                values.capacity ? `${values.capacity} places` : "Places illimitées",
                values.paymentMode === "free"
                  ? "Gratuit"
                  : priceCents > 0
                    ? `${values.price} € / pers.`
                    : null,
              ]
                .filter(Boolean)
                .join(" · ")}
            </p>
          </div>
        </div>

        <div className="flex flex-col gap-3 rounded-3xl bg-surface p-5">
          <p className="flex items-baseline justify-between">
            <span className="text-[15px] font-semibold text-ink">Prêt à publier</span>
            <span className="text-sm font-semibold text-ink">
              {ready}
              <span className="font-normal text-ink-muted"> / {checklist.length}</span>
            </span>
          </p>
          <div className="flex h-1 rounded-full bg-line-soft">
            <div
              className="h-1 rounded-full bg-ink transition-[width]"
              style={{ width: `${(ready / checklist.length) * 100}%` }}
            />
          </div>
          <ul className="flex flex-col gap-2.5 pt-1">
            {checklist.map((item) => (
              <li key={item.label} className="flex items-center gap-2.5 text-sm text-ink">
                {item.done ? (
                  <span className="flex size-[18px] items-center justify-center rounded-full bg-success text-white">
                    <Check size={10} />
                  </span>
                ) : (
                  <span className="size-[18px] rounded-full border-[1.5px] border-line" />
                )}
                <span className={item.done ? undefined : "text-ink-muted"}>{item.label}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="flex flex-col gap-3 rounded-3xl bg-surface p-5">
          <div className="hidden xl:block">{visibilityField("visibilityAside")}</div>
          <p className="text-xs leading-4 text-ink-muted">
            Horaires dans le fuseau de l'espace ({timeZone.replace("_", " ")}).
          </p>
        </div>
      </aside>
    </form>
  );
}
