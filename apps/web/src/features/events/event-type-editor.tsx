import {
  BOOKING_NOUNS,
  type BookingNoun,
  type BookingRules,
  type EventTypeField,
  eventTypeFieldsSchema,
  FIELD_TYPES,
  type FieldScope,
  fieldsOfScope,
} from "@horaya/core";
import { isRedirect, useRouter } from "@tanstack/react-router";
import { type ReactNode, useState, useTransition } from "react";
import { FieldInputs } from "@/components/app/field-inputs";
import { PageHeader } from "@/components/app/page-header";
import { ActionBar } from "@/components/ui/action-bar";
import { Button, ButtonLink } from "@/components/ui/button";
import { AffixInput, Checkbox, Field, inputClasses } from "@/components/ui/field";
import { FormAlert } from "@/components/ui/form-alert";
import {
  CalendarIcon,
  ChevronDown,
  ReceiptIcon,
  TicketIcon,
  UsersIcon,
} from "@/components/ui/icons";
import { FormSection } from "@/components/ui/section";
import { Select } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { archiveEventTypeAction, saveEventType } from "@/functions/events";
import { cn } from "@/lib/cn";
import { BOOKING_NOUN_LABELS, FIELD_TYPE_LABELS } from "@/lib/fields";
import { formatMoney } from "@/lib/format";
import { centsToInput, parseEuroToCents } from "@/lib/money";
import { useFormAction } from "@/lib/use-form-action";
import type { FormState } from "@/server/form-state";
import { type EditableField, FieldListEditor } from "./field-list-editor";

export const TYPE_COLORS = [
  "#528D74",
  "#D8BC66",
  "#CF879C",
  "#66537C",
  "#264489",
  "#3165B8",
  "#A9663F",
];

const DURATIONS: Array<[string, string]> = [
  ["", "—"],
  ["30", "30 min"],
  ["60", "1 h"],
  ["90", "1 h 30"],
  ["120", "2 h"],
  ["150", "2 h 30"],
  ["180", "3 h"],
  ["240", "4 h"],
  ["1440", "1 jour"],
];

const ADVANCE: Array<[string, string]> = [
  ["", "le début"],
  ["2", "2 h avant"],
  ["24", "J-1"],
  ["48", "J-2"],
  ["72", "J-3"],
  ["168", "J-7"],
];

export interface EventTypeEditorValues {
  id: string | null;
  name: string;
  color: string;
  bookingNoun: BookingNoun;
  defaultDurationMinutes: number | null;
  defaultPriceCents: number | null;
  defaultCapacity: number | null;
  requiresApproval: boolean;
  bookingRules: BookingRules;
  fields: EventTypeField[];
  eventCount: number;
  /** Événements à venir sans inscription (« Appliquer aussi aux N événements à venir »). */
  upcomingUnbooked: number;
  /** Nouveau type : modèle ou type d'origine (« Créé depuis le modèle « Cours collectif » »). */
  origin: string | null;
}

/** Les champs d'une liste complète, rangés par portée (l'ordre de chaque portée est gardé). */
const byScope = (fields: EditableField[], scope: FieldScope) =>
  fields.filter((field) => field.scope === scope);

/** Ligne de « Fonctionnement » qui s'ouvre sur ses réglages (maquette 9.1, section 2). */
function SettingRow({
  icon,
  title,
  summary,
  open,
  onToggle,
  children,
}: {
  icon: ReactNode;
  title: string;
  summary: string;
  open: boolean;
  onToggle: () => void;
  children: ReactNode;
}) {
  return (
    <div
      className={cn(
        "flex flex-col rounded-2xl",
        open ? "border-[1.5px] border-ink bg-surface" : "bg-field",
      )}
    >
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="flex items-center gap-3.5 p-3 text-left"
      >
        <span
          className={cn(
            "flex size-9 shrink-0 items-center justify-center rounded-[10px]",
            open ? "bg-ink text-on-ink" : "bg-surface text-ink",
          )}
        >
          {icon}
        </span>
        <span className="flex min-w-0 grow flex-col gap-0.5">
          <span className="text-[15px] font-semibold leading-5 text-ink">{title}</span>
          <span className="text-[13px] leading-[17px] text-ink-muted">{summary}</span>
        </span>
        <ChevronDown className={cn("mr-1.5 shrink-0 transition-transform", open && "rotate-180")} />
      </button>
      {/* Replié, les réglages restent dans le formulaire (envoyés avec le reste). */}
      <div hidden={!open} className="flex flex-col gap-4 px-3 pb-4 sm:pl-[62px]">
        {children}
      </div>
    </div>
  );
}

/** Aperçu en direct (colonne de droite) : inscription, formulaire d'événement, page publique. */
function Preview({
  workspaceName,
  name,
  color,
  noun,
  priceCents,
  durationLabel,
  fields,
}: {
  workspaceName: string;
  name: string;
  color: string;
  noun: BookingNoun;
  priceCents: number;
  durationLabel: string;
  fields: EditableField[];
}) {
  const [tab, setTab] = useState<"event" | "page" | "booking">("booking");
  const typed = fields as EventTypeField[];
  const described = fieldsOfScope(typed, "event");
  const visible = described.filter((field) => field.visibility !== "internal");
  const sample = (field: EventTypeField) =>
    field.options?.[0] ??
    (field.type === "boolean" ? "Oui" : field.type === "number" ? "2" : (field.help ?? "…"));
  const price = Number.isFinite(priceCents) && priceCents > 0 ? formatMoney(priceCents) : null;
  return (
    <aside className="flex w-full shrink-0 flex-col gap-3 lg:sticky lg:top-4 lg:w-[340px]">
      <div className="flex items-center justify-between px-1">
        <h2 className="text-base font-semibold leading-5 text-ink">Aperçu en direct</h2>
        <span className="text-label leading-4 text-ink-subtle">suit chaque changement</span>
      </div>
      <div
        role="tablist"
        aria-label="Aperçu"
        className="flex h-10 gap-1 rounded-full bg-surface p-[3px]"
      >
        {(
          [
            ["event", "Événement"],
            ["page", "Page"],
            ["booking", "Inscription"],
          ] as const
        ).map(([value, label]) => (
          <button
            key={value}
            type="button"
            role="tab"
            aria-selected={tab === value}
            onClick={() => setTab(value)}
            className={cn(
              "flex flex-1 items-center justify-center rounded-full text-[13px] font-semibold leading-4",
              tab === value ? "bg-ink text-on-ink" : "text-ink hover:bg-field",
            )}
          >
            {label}
          </button>
        ))}
      </div>
      <div className="flex flex-col overflow-hidden rounded-3xl bg-surface shadow-[0_1px_2px_rgba(0,0,0,0.04),0_16px_40px_rgba(0,0,0,0.06)]">
        <div
          className="flex flex-col gap-1 px-[18px] pt-[18px] pb-3.5"
          style={{ backgroundColor: color }}
        >
          <p className="text-[11px] font-bold uppercase leading-[14px] tracking-[0.06em] text-white/80">
            {workspaceName}
          </p>
          <p className="text-xl font-semibold leading-6 text-white">{name || "Nom du type"}</p>
          <p className="text-[13px] leading-[17px] text-white/90">
            {[durationLabel, visible[0] ? sample(visible[0]) : null].filter(Boolean).join(" · ")}
          </p>
        </div>
        {/* Champs de démonstration : hors de l'envoi (noms en « apercu. »), rien n'est requis. */}
        <div className="flex flex-col gap-3.5 px-[18px] pt-4 pb-[18px]">
          {tab === "booking" && (
            <>
              <FieldInputs
                fields={fieldsOfScope(typed, "participant")}
                prefix="apercu.p."
                enforceRequired={false}
                className="flex flex-col gap-3"
              />
              <FieldInputs
                fields={fieldsOfScope(typed, "booking")}
                prefix="apercu.a."
                enforceRequired={false}
                className="flex flex-col gap-3"
              />
              <div
                className="flex h-11 items-center justify-center rounded-full text-sm font-semibold text-white"
                style={{ backgroundColor: color }}
              >
                {BOOKING_NOUN_LABELS[noun].action}
                {price ? ` · ${price}` : ""}
              </div>
            </>
          )}
          {tab === "event" &&
            (described.length > 0 ? (
              <>
                <p className="text-[13px] font-semibold text-ink-muted">
                  Section « Ce que tu décris » du formulaire d'événement
                </p>
                <FieldInputs
                  fields={described}
                  prefix="apercu.e."
                  enforceRequired={false}
                  className="flex flex-col gap-3"
                />
              </>
            ) : (
              <p className="text-sm text-ink-muted">
                Ajoute des informations dans « Ce que tu décris » : elles apparaîtront dans le
                formulaire de chaque événement.
              </p>
            ))}
          {tab === "page" && (
            <>
              {visible.some((field) => field.publicFilter) && (
                <div className="flex flex-wrap gap-1.5">
                  {visible
                    .filter((field) => field.publicFilter)
                    .flatMap((field) => field.options ?? [])
                    .slice(0, 4)
                    .map((option, index) => (
                      <span
                        key={option}
                        className={cn(
                          "rounded-full px-3 py-1 text-xs font-semibold",
                          index === 0 ? "bg-ink text-on-ink" : "bg-field text-ink",
                        )}
                      >
                        {option}
                      </span>
                    ))}
                </div>
              )}
              {visible.length > 0 ? (
                <dl className="flex flex-col gap-2">
                  {visible.map((field) => (
                    <div key={field.key} className="flex justify-between gap-4">
                      <dt className="text-[13px] text-ink-muted">{field.label}</dt>
                      <dd className="text-sm font-semibold text-ink">{sample(field)}</dd>
                    </div>
                  ))}
                </dl>
              ) : (
                <p className="text-sm text-ink-muted">
                  Les informations publiques de « Ce que tu décris » s'affichent ici.
                </p>
              )}
              {described.length > visible.length && (
                <p className="text-xs text-ink-subtle">
                  {described.length - visible.length} information
                  {described.length - visible.length > 1 ? "s" : ""} interne
                  {described.length - visible.length > 1 ? "s" : ""}, pour l'équipe seulement.
                </p>
              )}
            </>
          )}
        </div>
      </div>
    </aside>
  );
}

/** Maquette 9.1 : éditeur d'un type (Identité, Fonctionnement, Ce que tu décris, Ce que tu demandes). */
export function EventTypeEditor({
  initial,
  workspaceName,
}: {
  initial: EventTypeEditorValues;
  workspaceName: string;
}) {
  const { state, onSubmit, pending } = useFormAction<FormState>(
    saveEventType.bind(null, initial.id),
    {},
  );
  const errors = state.fieldErrors ?? {};
  const [name, setName] = useState(initial.name);
  const [color, setColor] = useState(initial.color);
  const [noun, setNoun] = useState<BookingNoun>(initial.bookingNoun);
  const [price, setPrice] = useState(
    initial.defaultPriceCents ? centsToInput(initial.defaultPriceCents) : "",
  );
  const [capacity, setCapacity] = useState(initial.defaultCapacity?.toString() ?? "");
  const [maxSeats, setMaxSeats] = useState(
    initial.bookingRules.maxSeatsPerBooking?.toString() ?? "",
  );
  const [duration, setDuration] = useState(initial.defaultDurationMinutes?.toString() ?? "");
  const [approval, setApproval] = useState(initial.requiresApproval);
  const [waitlist, setWaitlist] = useState(initial.bookingRules.waitlistEnabled ?? false);
  const [advance, setAdvance] = useState(initial.bookingRules.minAdvanceHours?.toString() ?? "");
  const [fields, setFields] = useState<EditableField[]>(initial.fields);
  const [open, setOpen] = useState<string | null>(null);
  const router = useRouter();
  const [archiving, startArchive] = useTransition();
  const [archiveError, setArchiveError] = useState<string | null>(null);
  const colors = TYPE_COLORS.includes(initial.color)
    ? TYPE_COLORS
    : [...TYPE_COLORS, initial.color];

  /** Remplace les champs d'une portée ; renvoie l'erreur du schéma du core, sinon null. */
  const replace = (scope: FieldScope) => (next: EditableField[]) => {
    const all = (["event", "booking", "participant"] as const).flatMap((entry) =>
      entry === scope ? next : byScope(fields, entry),
    );
    const result = eventTypeFieldsSchema.safeParse(all);
    if (!result.success) return result.error.issues[0]?.message ?? "Champ invalide";
    setFields(all);
    return null;
  };
  const toggle = (row: string) => setOpen((current) => (current === row ? null : row));
  const durationLabel = DURATIONS.find(([value]) => value === duration)?.[1] ?? "—";
  const priceCents = parseEuroToCents(price);

  const subtitle = (
    <>
      {initial.origin && `${initial.origin}. `}
      <span className="text-ink">
        Choisis comment il fonctionne, ce que tu décris et ce que tu demandes : le formulaire
        d'événement, la page publique et l'inscription suivent.
      </span>
    </>
  );

  return (
    <div className="flex flex-1 flex-col">
      <PageHeader
        eyebrow={`Événements / Types / ${initial.id ? initial.name : "Nouveau type"}`}
        title={name || "Nouveau type"}
        subtitle={subtitle}
      />
      <form
        onSubmit={onSubmit}
        className="flex flex-col gap-4 px-4 pb-4 lg:flex-row lg:items-start"
      >
        <div className="flex min-w-0 flex-1 flex-col gap-4">
          {state.error && <FormAlert>{state.error}</FormAlert>}

          <FormSection number={1} title="Identité">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
              <div className="min-w-0 flex-1">
                <Field label="Nom du type" required error={errors.name}>
                  {(props) => (
                    <input
                      {...props}
                      name="name"
                      required
                      maxLength={60}
                      value={name}
                      onChange={(event) => setName(event.target.value)}
                      placeholder="Cours de tournage"
                      className={inputClasses()}
                    />
                  )}
                </Field>
              </div>
              <fieldset className="flex shrink-0 flex-col gap-2">
                <legend className="mb-2 text-[13px] font-semibold leading-[17px] text-ink">
                  Couleur
                </legend>
                <input type="hidden" name="color" value={color} />
                <div className="flex h-11 flex-wrap items-center gap-1.5">
                  {colors.map((swatch) => (
                    <button
                      key={swatch}
                      type="button"
                      onClick={() => setColor(swatch)}
                      aria-label={`Couleur ${swatch}`}
                      aria-pressed={color === swatch}
                      className={cn(
                        "size-[30px] rounded-full border-2 p-0.5",
                        color === swatch ? "border-ink" : "border-transparent",
                      )}
                    >
                      <span
                        className="block size-full rounded-full"
                        style={{ backgroundColor: swatch }}
                      />
                    </button>
                  ))}
                </div>
              </fieldset>
            </div>
            <Field
              label="Nom des réservations"
              hint={
                <p className="text-[13px] font-medium text-ink-muted">
                  Sur la page publique et le bouton : « 3 {BOOKING_NOUN_LABELS[noun].plural} », «{" "}
                  {BOOKING_NOUN_LABELS[noun].action} ».
                </p>
              }
            >
              {(props) => (
                <Select
                  {...props}
                  name="bookingNoun"
                  value={noun}
                  onChange={(event) => setNoun(event.target.value as BookingNoun)}
                  className="sm:max-w-[260px]"
                >
                  {BOOKING_NOUNS.map((value) => (
                    <option key={value} value={value}>
                      {BOOKING_NOUN_LABELS[value].singular}
                    </option>
                  ))}
                </Select>
              )}
            </Field>
          </FormSection>

          <FormSection number={2} title="Fonctionnement" description="Comment ce type marche">
            <div className="flex flex-col gap-1.5">
              <SettingRow
                icon={<UsersIcon />}
                title="Places"
                summary={[
                  capacity ? `${capacity} par défaut` : "Illimitées par défaut",
                  maxSeats ? `${maxSeats} au plus par ${BOOKING_NOUN_LABELS[noun].singular}` : null,
                  waitlist ? "liste d'attente quand c'est complet" : null,
                ]
                  .filter(Boolean)
                  .join(" · ")}
                open={open === "places"}
                onToggle={() => toggle("places")}
              >
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Places par défaut" error={errors.defaultCapacity}>
                    {(props) => (
                      <AffixInput
                        {...props}
                        name="defaultCapacity"
                        inputMode="numeric"
                        value={capacity}
                        onChange={(event) => setCapacity(event.target.value)}
                        placeholder="Illimité"
                        suffix="places"
                      />
                    )}
                  </Field>
                  <Field
                    label={`Au plus par ${BOOKING_NOUN_LABELS[noun].singular}`}
                    error={errors["bookingRules.maxSeatsPerBooking"]}
                  >
                    {(props) => (
                      <AffixInput
                        {...props}
                        name="maxSeatsPerBooking"
                        inputMode="numeric"
                        value={maxSeats}
                        onChange={(event) => setMaxSeats(event.target.value)}
                        placeholder="Pas de limite"
                        suffix="places"
                      />
                    )}
                  </Field>
                </div>
                <Switch
                  name="waitlistEnabled"
                  checked={waitlist}
                  onChange={(event) => setWaitlist(event.target.checked)}
                  label="Liste d'attente quand c'est complet"
                />
              </SettingRow>
              <SettingRow
                icon={<ReceiptIcon />}
                title="Prix"
                summary={
                  priceCents > 0
                    ? `${formatMoney(priceCents)} par place par défaut`
                    : "Gratuit par défaut"
                }
                open={open === "price"}
                onToggle={() => toggle("price")}
              >
                <Field label="Prix par défaut" error={errors.defaultPriceCents}>
                  {(props) => (
                    <AffixInput
                      {...props}
                      name="defaultPrice"
                      inputMode="decimal"
                      value={price}
                      onChange={(event) => setPrice(event.target.value)}
                      placeholder="Gratuit"
                      suffix="€"
                    />
                  )}
                </Field>
              </SettingRow>
              <SettingRow
                icon={<CalendarIcon />}
                title="Durée"
                summary={duration ? `${durationLabel} par défaut` : "Libre"}
                open={open === "duration"}
                onToggle={() => toggle("duration")}
              >
                <Field label="Durée par défaut">
                  {(props) => (
                    <Select
                      {...props}
                      name="defaultDuration"
                      value={duration}
                      onChange={(event) => setDuration(event.target.value)}
                      className="sm:max-w-[260px]"
                    >
                      {DURATIONS.map(([value, label]) => (
                        <option key={value} value={value}>
                          {label}
                        </option>
                      ))}
                    </Select>
                  )}
                </Field>
              </SettingRow>
              <SettingRow
                icon={<TicketIcon />}
                title={`Ouverture des ${BOOKING_NOUN_LABELS[noun].plural}`}
                summary={[
                  approval ? "Validation de chaque demande" : "Confirmées d'office",
                  `en ligne jusqu'à ${ADVANCE.find(([value]) => value === advance)?.[1] ?? "le début"}`,
                ].join(" · ")}
                open={open === "opening"}
                onToggle={() => toggle("opening")}
              >
                <Switch
                  name="requiresApproval"
                  checked={approval}
                  onChange={(event) => setApproval(event.target.checked)}
                  label="Valider chaque demande à la main"
                />
                <Field label="En ligne jusqu'à">
                  {(props) => (
                    <Select
                      {...props}
                      name="minAdvanceHours"
                      value={advance}
                      onChange={(event) => setAdvance(event.target.value)}
                      className="sm:max-w-[260px]"
                    >
                      {ADVANCE.map(([value, label]) => (
                        <option key={value} value={value}>
                          {label}
                        </option>
                      ))}
                    </Select>
                  )}
                </Field>
              </SettingRow>
            </div>
          </FormSection>

          <input type="hidden" name="fields" value={JSON.stringify(fields)} />
          <FormSection
            number={3}
            title="Ce que tu décris"
            description="Rempli sur chaque événement, visible sur sa page"
          >
            <FieldListEditor
              fields={byScope(fields, "event")}
              scope="event"
              all={fields}
              onChange={replace("event")}
              describes
              types={FIELD_TYPES.filter((type) => type !== "acceptance")}
              addLabel="Ajouter une information"
              addHint="texte, nombre, choix, date, oui / non, lien"
            />
          </FormSection>

          <FormSection
            number={4}
            title="Ce que tu demandes"
            description="Les questions du formulaire d'inscription"
          >
            {(
              [
                ["booking", "Une fois par inscription", "À la personne qui inscrit"],
                [
                  "participant",
                  "Pour chaque participant",
                  "Répété autant de fois qu'il y a de places réservées",
                ],
              ] as const
            ).map(([scope, title, hint]) => (
              <div key={scope} className="flex flex-col gap-2">
                <p className="flex flex-wrap items-baseline gap-x-2 pb-0.5">
                  <span className="text-[15px] font-semibold leading-5 text-ink">{title}</span>
                  <span className="text-[13px] leading-[17px] text-ink-subtle">{hint}</span>
                </p>
                <FieldListEditor
                  fields={byScope(fields, scope)}
                  scope={scope}
                  all={fields}
                  onChange={replace(scope)}
                  addLabel="Ajouter une question"
                  addHint={Object.values(FIELD_TYPE_LABELS).join(", ").toLowerCase()}
                />
              </div>
            ))}
            {errors.fields && <FormAlert>{errors.fields}</FormAlert>}
          </FormSection>

          {initial.id && initial.upcomingUnbooked > 0 && (
            <div className="rounded-3xl bg-surface px-5 py-4">
              <Checkbox
                name="applyToUpcoming"
                label={`Appliquer aussi aux ${initial.upcomingUnbooked} événement${initial.upcomingUnbooked > 1 ? "s" : ""} à venir sans inscription`}
              />
            </div>
          )}

          <ActionBar
            message={
              initial.id ? (
                <>
                  Utilisé par{" "}
                  <strong>
                    {initial.eventCount} événement{initial.eventCount > 1 ? "s" : ""}
                  </strong>{" "}
                  · les changements valent pour les prochains.
                </>
              ) : (
                "Le type sera proposé à la création de tes événements."
              )
            }
          >
            {initial.id && (
              <Button
                variant="inverse-danger"
                disabled={archiving}
                onClick={() =>
                  startArchive(async () => {
                    try {
                      const result = await archiveEventTypeAction(initial.id ?? "");
                      if (result?.error) setArchiveError(result.error);
                    } catch (error) {
                      // Type archivé : le serveur renvoie vers la liste.
                      if (!isRedirect(error)) throw error;
                      await router.navigate(error.options);
                    }
                  })
                }
              >
                {archiving ? "Suppression…" : "Supprimer"}
              </Button>
            )}
            {initial.id && (
              <ButtonLink
                href={`/app/evenements/types?type=nouveau&depuis=${initial.id}`}
                variant="inverse-outline"
              >
                Dupliquer le type
              </ButtonLink>
            )}
            <Button type="submit" variant="inverse" pending={pending}>
              {initial.id ? "Enregistrer" : "Créer le type"}
            </Button>
          </ActionBar>
          {archiveError && <FormAlert>{archiveError}</FormAlert>}
        </div>

        <Preview
          workspaceName={workspaceName}
          name={name}
          color={color}
          noun={noun}
          priceCents={priceCents}
          durationLabel={duration ? durationLabel : ""}
          fields={fields}
        />
      </form>
    </div>
  );
}
