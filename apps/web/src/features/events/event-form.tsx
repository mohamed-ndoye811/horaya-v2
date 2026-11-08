import {
  type DepositModule,
  type DurationOption,
  defaultRate,
  durationLabel,
  type EventTypeField,
  type FieldValues,
  fieldsOfScope,
  generateOccurrences,
  type PricingModule,
} from "@horaya/core";
import { type ReactNode, useMemo, useState } from "react";
import { FieldInputs } from "@/components/app/field-inputs";
import { Collapse } from "@/components/motion/collapse";
import { Swap } from "@/components/motion/swap";
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
import { formatHour, formatWeekdayShort, plural } from "@/lib/format";
import { centsToInput, parseEuroToCents } from "@/lib/money";
import { useFormAction } from "@/lib/use-form-action";
import { useInvalidMessage } from "@/lib/use-invalid-message";
import type { FormState } from "@/server/form-state";
import { type SessionDraft, StageSessions } from "./stage-sessions";

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
  /** Module « Conditions d'accès » sur invitation. */
  inviteOnly: boolean;
  /** Tarifs et options du type (à la modification : ceux de l'événement). */
  pricing: PricingModule | null;
  /** Acompte de départ du type. */
  deposit: DepositModule | null;
  /** Module Intervenant : membres proposés (liste vide : toute l'équipe), null sans le module. */
  staff: { memberIds: string[] } | null;
  /** Module Matériel avancé : un besoin par type de matériel visé. */
  needs: Array<{ id: string; itemTypeId: string }>;
  /** Module Lieu. */
  locationMode: "venue" | "online" | "client" | null;
  /** Module « Durée au choix » : les durées du type (l'événement en prend une). */
  durations: DurationOption[] | null;
  defaultDurationId: string | null;
  /** Module « Plusieurs séances » : réglages de départ d'un stage. */
  stage: { singleSession: boolean; sameEquipment: boolean } | null;
  /** Module Créneaux : les événements naissent des réservations. */
  slots: boolean;
}

/** Équipe et exemplaires de l'espace, pour l'intervenant et les exemplaires proposés. */
export interface ResourceChoices {
  members: Array<{ id: string; name: string }>;
  itemTypes: Record<string, { name: string; units: Array<{ id: string; label: string }> }>;
}

/** Saisie de l'acompte à partir du module. */
export function depositInputs(deposit: DepositModule | null | undefined) {
  return {
    depositKind: deposit?.amountCents !== undefined ? "fixed" : "percent",
    depositValue:
      deposit?.amountCents !== undefined
        ? centsToInput(deposit.amountCents)
        : deposit?.percent !== undefined
          ? String(deposit.percent)
          : "",
    depositBalance: deposit?.balance ?? "on_site",
  };
}

/** Prix saisis des tarifs et options, par identifiant. */
export const pricingInputs = (pricing: PricingModule | null | undefined) =>
  Object.fromEntries(
    [...(pricing?.rates ?? []), ...(pricing?.options ?? [])].map((entry) => [
      entry.id,
      centsToInput(entry.priceCents),
    ]),
  );

export interface EventFormValues {
  title: string;
  eventTypeId: string;
  description: string;
  startDate: string;
  startTime: string;
  endDate: string;
  endTime: string;
  locationName: string;
  locationAddress: string;
  /** Module Intervenant : membre choisi (vide : aucun). */
  staffMemberId: string;
  /** Module Matériel avancé : exemplaires proposés par besoin (liste vide : tous). */
  equipmentUnits: Record<string, string[]>;
  onlineUrl: string;
  capacity: string;
  price: string;
  paymentMode: string;
  /** Acompte : en pourcentage ou montant fixe par place, le reste sur place ou plus tard. */
  depositKind: string;
  depositValue: string;
  depositBalance: string;
  /** Prix des tarifs et options du type (module « Tarifs et options »). */
  prices: Record<string, string>;
  /** Lien de paiement propre à l'événement (sinon celui des paramètres). */
  paymentLinkUrl: string;
  requiresApproval: boolean;
  visibility: string;
  /** Points forts séparés par des virgules (« Déjeuner inclus, Accessible PMR »). */
  highlights: string;
  /** Module « Durée au choix » : la durée de l'événement. */
  durationId: string;
  /** Module « Plusieurs séances » : les séances du stage et ses deux réglages. */
  sessions: SessionDraft[];
  singleSession: boolean;
  sameEquipment: boolean;
}

const PAYMENT_OPTIONS = [
  { value: "free", label: "Gratuit", description: "Inscription seule" },
  { value: "online", label: "Paiement en ligne", description: "Lien de paiement" },
  { value: "deposit", label: "Acompte", description: "Une part à l'inscription" },
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
  resources,
}: {
  resources: ResourceChoices;
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
  // Exemplaires proposés : seulement les besoins du type choisi, une liste vide = tous.
  const restrictions = Object.fromEntries(
    (type?.needs ?? []).map((need) => [need.id, values.equipmentUnits[need.id] ?? []]),
  );

  function changeType(id: string) {
    const next = types.find((entry) => entry.id === id);
    if (!next || eventId) return set({ eventTypeId: id });
    const duration =
      next.durations?.find((option) => option.id === next.defaultDurationId) ?? next.durations?.[0];
    const minutes = duration?.minutes ?? next.defaultDurationMinutes;
    const end = minutes ? shift(values.startDate, values.startTime, minutes) : null;
    set({
      durationId: duration?.id ?? "",
      // Stage : une première séance à la date choisie, à compléter.
      ...(next.stage
        ? {
            singleSession: next.stage.singleSession,
            sameEquipment: next.stage.sameEquipment,
            sessions: values.sessions.length
              ? values.sessions
              : [{ date: values.startDate, start: "10:00", end: "17:00", topic: "" }],
          }
        : {}),
      eventTypeId: id,
      requiresApproval: next.requiresApproval,
      ...(next.inviteOnly ? { visibility: "invite_only" } : {}),
      ...(values.capacity === "" && next.defaultCapacity
        ? { capacity: String(next.defaultCapacity) }
        : {}),
      ...(values.price === "" && next.defaultPriceCents
        ? {
            price: (next.defaultPriceCents / 100).toFixed(2).replace(".", ","),
            paymentMode: values.paymentMode === "free" ? "on_site" : values.paymentMode,
          }
        : {}),
      // Tarifs du type, et son acompte s'il en a un.
      prices: pricingInputs(next.pricing),
      ...(next.pricing && values.paymentMode === "free" ? { paymentMode: "on_site" } : {}),
      ...(next.deposit ? { paymentMode: "deposit", ...depositInputs(next.deposit) } : {}),
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

  const pricing = type?.pricing ?? null;
  // Stage : les séances remplacent la date unique et la répétition (à la création).
  const stage = !eventId && type?.stage ? type.stage : null;
  const durations = !eventId && !stage && !type?.slots ? (type?.durations ?? null) : null;
  const firstSession = values.sessions[0];
  const priceCents =
    values.paymentMode === "free"
      ? 0
      : pricing
        ? parseEuroToCents(values.prices[defaultRate(pricing).id] ?? "")
        : parseEuroToCents(values.price);
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
        (values.paymentMode === "free" ||
          priceCents > 0 ||
          Object.values(values.prices).some((price) => parseEuroToCents(price) > 0)) &&
        (values.paymentMode !== "deposit" || values.depositValue !== ""),
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
      <div className="reveal-group flex min-w-0 flex-col gap-4">
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

        <FormSection
          number={2}
          title={stage ? "Les séances" : "Date & lieu"}
          description={stage ? "Une seule inscription pour toutes les dates" : undefined}
        >
          {stage ? (
            <>
              {/* Repères de l'événement : la première séance (le serveur lit les séances). */}
              <input type="hidden" name="startDate" value={firstSession?.date ?? ""} />
              <input type="hidden" name="startTime" value={firstSession?.start ?? ""} />
              <input type="hidden" name="endDate" value={firstSession?.date ?? ""} />
              <input type="hidden" name="endTime" value={firstSession?.end ?? ""} />
              <StageSessions
                sessions={values.sessions}
                onChange={(sessions) => set({ sessions })}
                pricing={pricing}
                prices={values.prices}
                onPricesChange={(prices) => set({ prices })}
                price={values.price}
                onPriceChange={(price) => set({ price })}
                paid={values.paymentMode !== "free"}
                singleSession={values.singleSession}
                sameEquipment={values.sameEquipment}
                onSettingsChange={(patch) => set(patch)}
                hasEquipment={(type?.needs.length ?? 0) > 0}
                error={errors.sessions ?? errors.prices}
              />
            </>
          ) : (
            <>
              {durations && (
                <Field label="Durée" error={errors.durationId}>
                  {(field) => (
                    <Select
                      {...field}
                      name="durationId"
                      value={values.durationId}
                      onChange={(event) => {
                        const option = durations.find((entry) => entry.id === event.target.value);
                        const end = option
                          ? shift(values.startDate, values.startTime, option.minutes)
                          : null;
                        set({
                          durationId: event.target.value,
                          ...(end ? { endDate: end.date, endTime: end.time } : {}),
                        });
                      }}
                      className="sm:max-w-[360px]"
                    >
                      {durations.map((option) => (
                        <option key={option.id} value={option.id}>
                          {option.label === durationLabel(option.minutes)
                            ? option.label
                            : `${option.label} (${durationLabel(option.minutes)})`}{" "}
                          · {(option.priceCents / 100).toLocaleString("fr-FR")} €
                        </option>
                      ))}
                    </Select>
                  )}
                </Field>
              )}
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
                  <Collapse open={recurring}>
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
                  </Collapse>
                </div>
              )}
              {(countInvalid.message ?? errors.recurrence) && (
                <FieldError>{countInvalid.message ?? errors.recurrence}</FieldError>
              )}
            </>
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
            <Field label="Adresse" error={errors.locationAddress}>
              {(field) => (
                <AffixInput
                  {...field}
                  name="locationAddress"
                  maxLength={300}
                  value={values.locationAddress}
                  onChange={(event) => set({ locationAddress: event.target.value })}
                  placeholder="Adresse de l'espace par défaut"
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
          <Collapse open={Boolean(type?.staff)}>
            <Field label="Intervenant" error={errors.staffMemberId}>
              {(field) => (
                <Select
                  {...field}
                  name="staffMemberId"
                  value={values.staffMemberId}
                  onChange={(event) => set({ staffMemberId: event.target.value })}
                >
                  <option value="">Pas encore choisi</option>
                  {resources.members
                    .filter(
                      (entry) =>
                        !type?.staff?.memberIds.length || type.staff.memberIds.includes(entry.id),
                    )
                    .map((entry) => (
                      <option key={entry.id} value={entry.id}>
                        {entry.name}
                      </option>
                    ))}
                </Select>
              )}
            </Field>
          </Collapse>
          {(type?.needs.length ?? 0) > 0 && (
            <>
              <input type="hidden" name="equipmentUnits" value={JSON.stringify(restrictions)} />
              {type?.needs.map((need) => {
                const category = resources.itemTypes[need.itemTypeId];
                if (!category) return null;
                const restricted = values.equipmentUnits[need.id] ?? [];
                const checked =
                  restricted.length === 0 ? category.units.map((u) => u.id) : restricted;
                const toggle = (unitId: string) => {
                  const next = checked.includes(unitId)
                    ? checked.filter((entry) => entry !== unitId)
                    : [...checked, unitId];
                  set({
                    equipmentUnits: {
                      ...values.equipmentUnits,
                      [need.id]: next.length === category.units.length ? [] : next,
                    },
                  });
                };
                return (
                  <Field key={need.id} label={`${category.name} proposés`} group>
                    {() => (
                      <div className="flex flex-wrap gap-x-5 gap-y-2">
                        {category.units.map((unit) => (
                          <Checkbox
                            key={unit.id}
                            checked={checked.includes(unit.id)}
                            disabled={checked.length === 1 && checked.includes(unit.id)}
                            onChange={() => toggle(unit.id)}
                            label={unit.label}
                          />
                        ))}
                      </div>
                    )}
                  </Field>
                );
              })}
            </>
          )}
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
            <Collapse open={values.paymentMode !== "free" && !pricing && !stage && !durations}>
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
            </Collapse>
          </div>
          <Collapse open={values.paymentMode !== "free" && pricing !== null && !stage}>
            <PriceInputs
              pricing={pricing}
              prices={values.prices}
              onChange={(prices) => set({ prices })}
              error={errors.prices}
            />
          </Collapse>
          <Collapse open={values.paymentMode === "deposit"}>
            <div className="grid gap-4 sm:grid-cols-3">
              <Field label="Acompte" required error={errors.deposit ?? errors["deposit.percent"]}>
                {(field) => (
                  <AffixInput
                    {...field}
                    name="depositValue"
                    inputMode={values.depositKind === "fixed" ? "decimal" : "numeric"}
                    value={values.depositValue}
                    onChange={(event) => set({ depositValue: event.target.value })}
                    suffix={values.depositKind === "fixed" ? "€ par place" : "%"}
                    mono
                  />
                )}
              </Field>
              <Field label="Calculé">
                {(field) => (
                  <Select
                    {...field}
                    name="depositKind"
                    value={values.depositKind}
                    onChange={(event) => set({ depositKind: event.target.value, depositValue: "" })}
                  >
                    <option value="percent">En pourcentage du total</option>
                    <option value="fixed">Montant fixe par place</option>
                  </Select>
                )}
              </Field>
              <Field label="Le reste">
                {(field) => (
                  <Select
                    {...field}
                    name="depositBalance"
                    value={values.depositBalance}
                    onChange={(event) => set({ depositBalance: event.target.value })}
                  >
                    <option value="on_site">Sur place</option>
                    <option value="later">Plus tard, en ligne</option>
                  </Select>
                )}
              </Field>
            </div>
          </Collapse>
          <Collapse open={values.paymentMode === "online" || values.paymentMode === "deposit"}>
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
          </Collapse>
          <Checkbox
            name="requiresApproval"
            checked={values.requiresApproval}
            onChange={(event) => set({ requiresApproval: event.target.checked })}
            label="Valider manuellement chaque réservation"
          />
        </FormSection>

        <Collapse open={described.length > 0}>
          <FormSection
            number={4}
            title="Ce que tu décris"
            description={`Les informations d'un ${type?.name.toLowerCase() ?? "événement"}`}
          >
            <div key={type?.id} className="animate-fade">
              <FieldInputs
                fields={described}
                prefix="f."
                errorPrefix="fieldValues."
                defaults={fieldValues}
                errors={errors}
              />
            </div>
          </FormSection>
        </Collapse>

        <ActionBar
          // Sur mobile, la liste « Prêt à publier » dit déjà ce qui manque.
          messageOnMobile={false}
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

      <aside className="reveal-group flex flex-col gap-4 xl:sticky xl:top-4 xl:self-start">
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
                values.capacity ? plural(Number(values.capacity), "place") : "Places illimitées",
                values.paymentMode === "free"
                  ? "Gratuit"
                  : priceCents > 0
                    ? `${centsToInput(priceCents)} € / pers.`
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
              <Swap value={String(ready)}>{ready}</Swap>
              <span className="font-normal text-ink-muted"> / {checklist.length}</span>
            </span>
          </p>
          <div className="flex h-1 rounded-full bg-line-soft">
            <div
              className="h-1 w-full origin-left rounded-full bg-ink transition-transform"
              style={{ transform: `scaleX(${ready / checklist.length})` }}
            />
          </div>
          <ul className="flex flex-col gap-2.5 pt-1">
            {checklist.map((item) => (
              <li key={item.label} className="flex items-center gap-2.5 text-sm text-ink">
                <span className="flex">
                  <Swap value={String(item.done)}>
                    {item.done ? (
                      <span className="flex size-[18px] items-center justify-center rounded-full bg-success text-white">
                        <Check size={10} />
                      </span>
                    ) : (
                      <span className="size-[18px] rounded-full border-[1.5px] border-line" />
                    )}
                  </Swap>
                </span>
                <span
                  className={item.done ? "transition-colors" : "text-ink-muted transition-colors"}
                >
                  {item.label}
                </span>
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

/** Tarifs et options de l'événement : les noms viennent du type, les prix se changent ici. */
function PriceInputs({
  pricing,
  prices,
  onChange,
  error,
}: {
  pricing: PricingModule | null;
  prices: Record<string, string>;
  onChange: (prices: Record<string, string>) => void;
  error: string | undefined;
}) {
  if (!pricing) return null;
  const rows = [
    ...pricing.rates.map((rate) => ({
      id: rate.id,
      name: rate.name,
      hint: [
        rate.description,
        rate.id === defaultRate(pricing).id && pricing.rates.length > 1 ? "par défaut" : null,
      ]
        .filter(Boolean)
        .join(" · "),
    })),
    ...(pricing.options ?? []).map((option) => ({
      id: option.id,
      name: `+ ${option.name}`,
      hint: option.per === "participant" ? "option, par participant" : "option, par inscription",
    })),
  ];
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="pb-2 text-[13px] font-semibold leading-[17px] text-ink">
        Tarifs et options
      </legend>
      {rows.map((row) => (
        <div key={row.id} className="flex items-center gap-3">
          <span className="flex min-w-0 grow flex-col">
            <span className="truncate text-sm font-semibold leading-[18px] text-ink">
              {row.name}
            </span>
            {row.hint && (
              <span className="truncate text-[13px] leading-[17px] text-ink-muted">{row.hint}</span>
            )}
          </span>
          <div className="w-32 shrink-0">
            <AffixInput
              aria-label={`Prix : ${row.name}`}
              name={`prix.${row.id}`}
              inputMode="decimal"
              value={prices[row.id] ?? ""}
              onChange={(event) => onChange({ ...prices, [row.id]: event.target.value })}
              suffix="€"
              mono
            />
          </div>
        </div>
      ))}
      {error && <FieldError>{error}</FieldError>}
    </fieldset>
  );
}
