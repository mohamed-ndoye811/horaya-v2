import {
  type CancellationPolicy,
  type DocumentsModule,
  type EventModules,
  fromZonedParts,
  MODULE_CATALOG,
  MODULE_GROUPS,
  type ModuleDefinition,
  type ModuleKey,
  moduleSummary,
  toZonedParts,
} from "@horaya/core";
import { type ReactNode, useRef, useState, useTransition } from "react";
import { Collapse } from "@/components/motion/collapse";
import { PresenceItem, PresenceList } from "@/components/motion/presence";
import { Button, textLinkClasses } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import {
  AffixInput,
  Field,
  FieldError,
  inputClasses,
  textareaClasses,
} from "@/components/ui/field";
import { ChevronDown, PlusIcon } from "@/components/ui/icons";
import { SearchInput } from "@/components/ui/search-input";
import { Select } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { uploadDocumentAction } from "@/functions/files";
import { cn } from "@/lib/cn";
import { formatOpening } from "@/lib/format";
import { centsToInput, parseEuroToCents } from "@/lib/money";
import { DepositPanel, PaymentMethodsPanel, PricingPanel } from "./money-panels";
import { EquipmentPanel, LocationPanel, StaffPanel } from "./resources-panels";

/** Saisie d'un nombre entier : vide → réglage absent. */
const whole = (value: string): number | undefined => {
  const trimmed = value.trim();
  if (trimmed === "") return undefined;
  const number = Number(trimmed);
  return Number.isFinite(number) ? Math.trunc(number) : undefined;
};
const shown = (value: number | undefined) => (value === undefined ? "" : String(value));

/** Icônes des modules (traits des maquettes 9.1 et 9.2). */
const ICON_PATHS: Record<ModuleKey, string> = {
  places:
    "M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75",
  waitlist: "M3 6h13M3 12h9M3 18h9M17 14v7M14 18l3 3 3-3",
  approval: "M20 6 9 17l-5-5",
  opening: "M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20M12 6v6l4 2",
  cancellation:
    "M8 2v4M16 2v4M3 10h18M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2M10 14l4 4M14 14l-4 4",
  access: "M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10",
  series: "m17 2 4 4-4 4M3 11v-1a4 4 0 0 1 4-4h14M7 22l-4-4 4-4M21 13v1a4 4 0 0 1-4 4H3",
  messages: "M4 4h16a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2M22 7l-10 6L2 7",
  documents: "M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8zM14 2v6h6M9 13h6M9 17h6",
  equipment: "M21 8 12 3 3 8v8l9 5 9-5zM3 8l9 5 9-5M12 13v8",
  location: "M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 0 1 16 0M12 13a3 3 0 1 0 0-6 3 3 0 0 0 0 6",
  staff: "M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8",
  pricing:
    "M12.6 2.6A2 2 0 0 0 11.2 2H4a2 2 0 0 0-2 2v7.2a2 2 0 0 0 .6 1.4l8.7 8.7a2.4 2.4 0 0 0 3.4 0l6.6-6.6a2.4 2.4 0 0 0 0-3.4zM7.5 8a.5.5 0 1 0 0-1 .5.5 0 0 0 0 1",
  deposit: "M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20M12 2a10 10 0 0 1 10 10H12z",
  payment_methods: "M2 7h20v12H2zM2 11h20M6 15h4",
};

function ModuleIcon({ moduleKey }: { moduleKey: ModuleKey }) {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      aria-hidden="true"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d={ICON_PATHS[moduleKey]} />
    </svg>
  );
}

const ACTIVE_KEYS = MODULE_CATALOG.filter((entry) => !entry.soon).map(
  (entry) => entry.key as ModuleKey,
);
const definition = (key: ModuleKey) =>
  MODULE_CATALOG.find((entry) => entry.key === key) as ModuleDefinition;

export interface ModuleContext {
  /** « inscription », « réservation »… */
  noun: string;
  structure: CancellationPolicy;
  timeZone: string;
  /** Modules Ressources : types de matériel et membres de l'équipe à proposer. */
  itemTypes: Array<{ id: string; name: string }>;
  members: Array<{ id: string; name: string }>;
  /** Formules de cartes de séances de l'espace (module « Moyens acceptés »). */
  passPlans?: ReadonlyArray<{ id: string; name: string }>;
}

/**
 * Maquette 9.1, section 2 « Fonctionnement » : un module par ligne (icône, nom, résumé),
 * dépliée sur ses réglages ; « Ajouter un module » ouvre le catalogue (maquette 9.2).
 */
export function ModuleList({
  modules,
  onChange,
  context,
  errors,
  onCreateRule,
}: {
  modules: EventModules;
  onChange: (next: EventModules) => void;
  context: ModuleContext;
  errors: Record<string, string>;
  /** Carte « Règles si… alors… » du catalogue : ouvre une nouvelle règle (section 5). */
  onCreateRule: () => void;
}) {
  const [open, setOpen] = useState<ModuleKey | null>(null);
  const [catalog, setCatalog] = useState(false);
  const active = ACTIVE_KEYS.filter((key) => modules[key] !== undefined);
  const set = <K extends ModuleKey>(key: K, value: EventModules[K]) =>
    onChange({ ...modules, [key]: value });
  const remove = (key: ModuleKey) => {
    const { [key]: _removed, ...rest } = modules;
    onChange(rest);
    setOpen(null);
  };

  return (
    <div className="relative flex flex-col gap-1.5">
      <PresenceList>
        {active.map((key) => {
          const moduleErrors = Object.entries(errors).filter(([path]) =>
            path.startsWith(`modules.${key}`),
          );
          return (
            <PresenceItem key={key}>
              <ModuleRow
                moduleKey={key}
                summary={moduleSummary(key, modules, {
                  ...context,
                  itemTypeNames: Object.fromEntries(context.itemTypes.map((t) => [t.id, t.name])),
                  memberNames: Object.fromEntries(context.members.map((m) => [m.id, m.name])),
                  formatDate: (date) => formatOpening(date, context.timeZone),
                })}
                open={open === key || moduleErrors.length > 0}
                onToggle={() => setOpen((current) => (current === key ? null : key))}
                onRemove={() => remove(key)}
                error={moduleErrors[0]?.[1]}
              >
                <ModulePanel moduleKey={key} modules={modules} set={set} context={context} />
              </ModuleRow>
            </PresenceItem>
          );
        })}
      </PresenceList>
      <button
        type="button"
        onClick={() => setCatalog(true)}
        className="press flex min-h-[52px] items-center justify-center gap-2 rounded-2xl border-[1.5px] border-dashed border-line-strong px-4 py-3 text-sm leading-[18px] hover:bg-field"
      >
        <PlusIcon size={12} className="text-ink" />
        <span className="font-semibold text-ink">Ajouter un module</span>
        <span className="hidden text-ink-subtle sm:inline">
          · tarifs, acompte, ouverture, annulation, messages…
        </span>
      </button>
      {catalog && (
        <ModuleCatalog
          modules={modules}
          onClose={() => setCatalog(false)}
          onCreateRule={() => {
            setCatalog(false);
            onCreateRule();
          }}
          onPick={(key) => {
            if (modules[key] === undefined) {
              set(key, structuredClone(definition(key).defaults) as EventModules[typeof key]);
            }
            setOpen(key);
            setCatalog(false);
          }}
        />
      )}
    </div>
  );
}

/** Ligne d'un module : repliée (fond gris, résumé), ouverte (contour noir, réglages). */
function ModuleRow({
  moduleKey,
  summary,
  open,
  onToggle,
  onRemove,
  error,
  children,
}: {
  moduleKey: ModuleKey;
  summary: string;
  open: boolean;
  onToggle: () => void;
  onRemove: () => void;
  error: string | undefined;
  children: ReactNode;
}) {
  const { name } = definition(moduleKey);
  return (
    <div
      className={cn(
        "flex flex-col rounded-2xl transition-colors",
        open
          ? "border-[1.5px] border-ink bg-surface"
          : "border-[1.5px] border-transparent bg-field",
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
            "flex size-9 shrink-0 items-center justify-center rounded-[10px] transition-colors",
            open ? "bg-ink text-on-ink" : "bg-surface text-ink",
          )}
        >
          <ModuleIcon moduleKey={moduleKey} />
        </span>
        <span className="flex min-w-0 grow flex-col gap-0.5">
          <span className="text-[15px] font-semibold leading-5 text-ink">{name}</span>
          <span className="text-[13px] leading-[17px] text-ink-muted">{summary}</span>
        </span>
        <span className="flex w-6 shrink-0 justify-center">
          <ChevronDown
            className={cn(
              "transition-transform",
              open ? "rotate-180 text-ink" : "-rotate-90 text-ink-subtle",
            )}
          />
        </span>
      </button>
      <Collapse open={open}>
        <div className="flex flex-col gap-4 px-3 pb-4 sm:pl-[62px]">
          {children}
          {error && <FieldError>{error}</FieldError>}
          <button
            type="button"
            onClick={onRemove}
            className={cn(textLinkClasses, "self-start text-[13px] text-ink-muted")}
          >
            Retirer le module
          </button>
        </div>
      </Collapse>
    </div>
  );
}

type Setter = <K extends ModuleKey>(key: K, value: EventModules[K]) => void;

/** Réglages d'un module (les panneaux suivent la ligne « Matériel » ouverte de la maquette). */
function ModulePanel({
  moduleKey,
  modules,
  set,
  context,
}: {
  moduleKey: ModuleKey;
  modules: EventModules;
  set: Setter;
  context: ModuleContext;
}) {
  switch (moduleKey) {
    case "places":
      return <PlacesPanel modules={modules} set={set} noun={context.noun} />;
    case "waitlist":
      return (
        <p className="text-sm leading-5 text-ink-muted">
          Quand c'est complet, les demandes passent en liste d'attente. Une place se libère : la
          demande suivante passe toute seule, et la personne reçoit un e-mail.
        </p>
      );
    case "approval":
      return (
        <p className="text-sm leading-5 text-ink-muted">
          Chaque nouvel événement de ce type demande ta validation : la place est retenue, la
          personne attend ton accord. Tu peux décocher la validation sur un événement précis.
        </p>
      );
    case "opening":
      return <OpeningPanel modules={modules} set={set} timeZone={context.timeZone} />;
    case "cancellation":
      return <CancellationPanel modules={modules} set={set} structure={context.structure} />;
    case "access":
      return <AccessPanel modules={modules} set={set} />;
    case "series":
      return <SeriesPanel modules={modules} set={set} />;
    case "messages":
      return <MessagesPanel modules={modules} set={set} />;
    case "equipment":
      return <EquipmentPanel modules={modules} set={set} context={context} />;
    case "location":
      return <LocationPanel modules={modules} set={set} />;
    case "staff":
      return <StaffPanel modules={modules} set={set} context={context} />;
    case "pricing":
      return <PricingPanel modules={modules} set={set} itemTypes={context.itemTypes} />;
    case "deposit":
      return <DepositPanel modules={modules} set={set} />;
    case "payment_methods":
      return (
        <PaymentMethodsPanel modules={modules} set={set} passPlans={context.passPlans ?? []} />
      );
    case "documents":
      return (
        <DocumentsPanel
          value={modules.documents ?? { files: [] }}
          onChange={(value) => set("documents", value)}
        />
      );
  }
}

function PlacesPanel({ modules, set, noun }: { modules: EventModules; set: Setter; noun: string }) {
  const places = modules.places ?? {};
  const minimum = places.minimum;
  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Places par défaut">
          {(props) => (
            <AffixInput
              {...props}
              inputMode="numeric"
              value={shown(places.capacity)}
              onChange={(event) =>
                set("places", { ...places, capacity: whole(event.target.value) })
              }
              placeholder="Illimité"
              suffix="places"
            />
          )}
        </Field>
        <Field label={`Au plus par ${noun}`}>
          {(props) => (
            <AffixInput
              {...props}
              inputMode="numeric"
              value={shown(places.maxPerBooking)}
              onChange={(event) =>
                set("places", { ...places, maxPerBooking: whole(event.target.value) })
              }
              placeholder="Pas de limite"
              suffix="places"
            />
          )}
        </Field>
      </div>
      <Switch
        checked={minimum !== undefined}
        onChange={(event) =>
          set("places", {
            ...places,
            minimum: event.target.checked ? { seats: 4, daysBefore: 2 } : undefined,
          })
        }
        label="Seuil de maintien"
        description="S'il manque des inscrits à la date choisie, l'événement est annulé : chaque inscrit est prévenu, les cartes de séances recréditées. L'équipe est prévenue la veille."
      />
      <Collapse open={minimum !== undefined}>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Maintenu à partir de">
            {(props) => (
              <AffixInput
                {...props}
                inputMode="numeric"
                value={shown(minimum?.seats)}
                onChange={(event) =>
                  set("places", {
                    ...places,
                    minimum: { daysBefore: 2, ...minimum, seats: whole(event.target.value) ?? 0 },
                  })
                }
                suffix="inscrits"
              />
            )}
          </Field>
          <Field label="Sinon annulé à">
            {(props) => (
              <Select
                {...props}
                value={String(minimum?.daysBefore ?? 2)}
                onChange={(event) =>
                  set("places", {
                    ...places,
                    minimum: { seats: 4, ...minimum, daysBefore: Number(event.target.value) },
                  })
                }
              >
                {[1, 2, 3, 4, 5, 7, 10, 14].map((days) => (
                  <option key={days} value={days}>
                    J-{days}
                  </option>
                ))}
              </Select>
            )}
          </Field>
        </div>
      </Collapse>
    </>
  );
}

const CLOSING_HOURS = [0, 1, 2, 6, 12, 24, 48, 72, 168];
const closingOption = (hours: number) =>
  hours === 0
    ? "Au début de l'événement"
    : hours % 24 === 0
      ? hours === 24
        ? "La veille (J-1)"
        : `J-${hours / 24}`
      : `${hours} h avant`;

function OpeningPanel({
  modules,
  set,
  timeZone,
}: {
  modules: EventModules;
  set: Setter;
  timeZone: string;
}) {
  const opening = modules.opening ?? {};
  const mode = opening.opensAt ? "date" : opening.opensDaysBefore ? "days" : "now";
  const fixed = opening.opensAt ? toZonedParts(new Date(opening.opensAt), timeZone) : null;
  const pad = (value: number) => String(value).padStart(2, "0");
  const [date, setDate] = useState(
    fixed ? `${fixed.year}-${pad(fixed.month)}-${pad(fixed.day)}` : "",
  );
  const [time, setTime] = useState(fixed ? `${pad(fixed.hour)}:${pad(fixed.minute)}` : "10:00");
  // Date et heure saisies dans le fuseau de l'espace → instant enregistré.
  const setFixed = (nextDate: string, nextTime: string) => {
    setDate(nextDate);
    setTime(nextTime);
    const [year, month, day] = nextDate.split("-").map(Number);
    const [hour, minute] = nextTime.split(":").map(Number);
    if (!year || !month || !day || hour === undefined || minute === undefined) return;
    const instant = fromZonedParts({ year, month, day, hour, minute }, timeZone);
    set("opening", { ...opening, opensDaysBefore: undefined, opensAt: instant.toISOString() });
  };
  const closing = opening.closesHoursBefore ?? 0;
  const closings = CLOSING_HOURS.includes(closing)
    ? CLOSING_HOURS
    : [...CLOSING_HOURS, closing].sort((a, b) => a - b);
  return (
    <>
      <Field label="Ouverture">
        {(props) => (
          <Select
            {...props}
            value={mode}
            onChange={(event) => {
              const next = event.target.value;
              if (next === "now") set("opening", { closesHoursBefore: opening.closesHoursBefore });
              if (next === "days")
                set("opening", {
                  closesHoursBefore: opening.closesHoursBefore,
                  opensDaysBefore: 30,
                });
              if (next === "date") setFixed(date, time);
            }}
            className="sm:max-w-[320px]"
          >
            <option value="now">Dès la publication</option>
            <option value="days">Quelques jours avant (J-N)</option>
            <option value="date">À une date fixe</option>
          </Select>
        )}
      </Field>
      <Collapse open={mode === "days"}>
        <Field label="Ouvre">
          {(props) => (
            <AffixInput
              {...props}
              inputMode="numeric"
              value={shown(opening.opensDaysBefore)}
              onChange={(event) =>
                set("opening", { ...opening, opensDaysBefore: whole(event.target.value) })
              }
              suffix="jours avant"
            />
          )}
        </Field>
      </Collapse>
      <Collapse open={mode === "date"}>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Le">
            {(props) => (
              <input
                {...props}
                type="date"
                value={date}
                onChange={(event) => setFixed(event.target.value, time)}
                className={inputClasses()}
              />
            )}
          </Field>
          <Field label="À">
            {(props) => (
              <input
                {...props}
                type="time"
                value={time}
                onChange={(event) => setFixed(date, event.target.value)}
                className={inputClasses()}
              />
            )}
          </Field>
        </div>
      </Collapse>
      <Field label="Fermeture des inscriptions en ligne">
        {(props) => (
          <Select
            {...props}
            value={String(closing)}
            onChange={(event) =>
              set("opening", {
                ...opening,
                closesHoursBefore: Number(event.target.value) || undefined,
              })
            }
            className="sm:max-w-[320px]"
          >
            {closings.map((hours) => (
              <option key={hours} value={hours}>
                {closingOption(hours)}
              </option>
            ))}
          </Select>
        )}
      </Field>
    </>
  );
}

function CancellationPanel({
  modules,
  set,
  structure,
}: {
  modules: EventModules;
  set: Setter;
  structure: CancellationPolicy;
}) {
  const cancellation = modules.cancellation ?? {};
  const hours = [0, 12, 24, 48, 72, 168];
  const percents = [0, 25, 50, 75, 100];
  const withCurrent = (list: number[], value: number | undefined) =>
    value === undefined || list.includes(value) ? list : [...list, value].sort((a, b) => a - b);
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <Field label="Annulation gratuite">
        {(props) => (
          <Select
            {...props}
            value={shown(cancellation.freeHours)}
            onChange={(event) =>
              set("cancellation", { ...cancellation, freeHours: whole(event.target.value) })
            }
          >
            <option value="">Comme la structure ({structure.freeCancellationHours} h avant)</option>
            {withCurrent(hours, cancellation.freeHours).map((value) => (
              <option key={value} value={value}>
                {value === 0 ? "Pas de délai gratuit" : `Jusqu'à ${value} h avant`}
              </option>
            ))}
          </Select>
        )}
      </Field>
      <Field label="Ensuite, remboursé">
        {(props) => (
          <Select
            {...props}
            value={shown(cancellation.lateRefundPercent)}
            onChange={(event) =>
              set("cancellation", {
                ...cancellation,
                lateRefundPercent: whole(event.target.value),
              })
            }
          >
            <option value="">
              Comme la structure ({structure.lateCancellationRefundPercent} %)
            </option>
            {withCurrent(percents, cancellation.lateRefundPercent).map((value) => (
              <option key={value} value={value}>
                {value === 0 ? "Rien : la séance est due" : `${value} %`}
              </option>
            ))}
          </Select>
        )}
      </Field>
    </div>
  );
}

function AccessPanel({ modules, set }: { modules: EventModules; set: Setter }) {
  const access = modules.access ?? {};
  const [tags, setTags] = useState((access.tags ?? []).join(", "));
  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Âge minimum">
          {(props) => (
            <AffixInput
              {...props}
              inputMode="numeric"
              value={shown(access.minAge)}
              onChange={(event) => set("access", { ...access, minAge: whole(event.target.value) })}
              placeholder="Aucun"
              suffix="ans"
            />
          )}
        </Field>
        <Field label="Âge maximum">
          {(props) => (
            <AffixInput
              {...props}
              inputMode="numeric"
              value={shown(access.maxAge)}
              onChange={(event) => set("access", { ...access, maxAge: whole(event.target.value) })}
              placeholder="Aucun"
              suffix="ans"
            />
          )}
        </Field>
      </div>
      {(access.minAge || access.maxAge) && (
        <p className="-mt-2 text-[13px] leading-[18px] text-ink-muted">
          La question « Âge » est posée pour chaque participant et contrôlée à l'inscription.
        </p>
      )}
      <Field
        label="Réservé aux clients étiquetés"
        hint={
          <p className="text-[13px] text-ink-muted">
            Étiquettes de la fiche client, séparées par des virgules (« adhérent »). Vide : ouvert à
            tous.
          </p>
        }
      >
        {(props) => (
          <input
            {...props}
            value={tags}
            onChange={(event) => {
              setTags(event.target.value);
              const list = event.target.value
                .split(",")
                .map((tag) => tag.trim())
                .filter(Boolean);
              set("access", { ...access, tags: list.length ? list : undefined });
            }}
            placeholder="adhérent"
            className={inputClasses()}
          />
        )}
      </Field>
      <Switch
        checked={access.inviteOnly ?? false}
        onChange={(event) =>
          set("access", { ...access, inviteOnly: event.target.checked || undefined })
        }
        label="Sur invitation"
        description="Les nouveaux événements de ce type sont créés « sur invitation » : seul un lien calendrier les ouvre."
      />
    </>
  );
}

function SeriesPanel({ modules, set }: { modules: EventModules; set: Setter }) {
  const series = modules.series ?? {};
  const [price, setPrice] = useState(
    series.priceCents !== undefined ? centsToInput(series.priceCents) : "",
  );
  return (
    <>
      <Field
        label="Prix de la série"
        hint={
          <p className="text-[13px] text-ink-muted">
            Vide : prix d'une séance × nombre de séances. Chaque série se règle ensuite dans son
            onglet « Série ».
          </p>
        }
      >
        {(props) => (
          <AffixInput
            {...props}
            inputMode="decimal"
            value={price}
            onChange={(event) => {
              setPrice(event.target.value);
              set("series", {
                ...series,
                priceCents:
                  event.target.value.trim() === ""
                    ? undefined
                    : parseEuroToCents(event.target.value),
              });
            }}
            placeholder="Séances × prix"
            suffix="€"
          />
        )}
      </Field>
      <Switch
        checked={series.dropInAllowed ?? true}
        onChange={(event) => set("series", { ...series, dropInAllowed: event.target.checked })}
        label="Séance à l'unité encore possible"
      />
      <Switch
        checked={series.prorata ?? true}
        onChange={(event) => set("series", { ...series, prorata: event.target.checked })}
        label="Inscription en cours de route au prorata"
      />
      <Switch
        checked={series.makeupAllowed ?? true}
        onChange={(event) => set("series", { ...series, makeupAllowed: event.target.checked })}
        label="Rattrapage d'une absence signalée à temps"
      />
    </>
  );
}

function MessagesPanel({ modules, set }: { modules: EventModules; set: Setter }) {
  const messages = modules.messages ?? {};
  const reminder = messages.reminder;
  const text = (value: string) => (value.trim() === "" ? undefined : value);
  return (
    <>
      <Field label="À apporter">
        {(props) => (
          <input
            {...props}
            value={messages.bring ?? ""}
            onChange={(event) => set("messages", { ...messages, bring: text(event.target.value) })}
            maxLength={300}
            placeholder="Une tenue qui ne craint rien"
            className={inputClasses()}
          />
        )}
      </Field>
      <Field label="Ajouté à l'e-mail de confirmation">
        {(props) => (
          <textarea
            {...props}
            value={messages.confirmation ?? ""}
            onChange={(event) =>
              set("messages", { ...messages, confirmation: text(event.target.value) })
            }
            maxLength={1000}
            placeholder="Le code de la porte est 1234, l'atelier est au fond de la cour."
            className={cn(textareaClasses(), "min-h-20")}
          />
        )}
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Rappel">
          {(props) => (
            <Select
              {...props}
              value={reminder?.kind ?? ""}
              onChange={(event) =>
                set("messages", {
                  ...messages,
                  reminder:
                    event.target.value === "eve"
                      ? { kind: "eve", hour: 18 }
                      : event.target.value === "before"
                        ? { kind: "before", hours: 2 }
                        : undefined,
                })
              }
            >
              <option value="">La veille, au premier passage</option>
              <option value="eve">La veille, à une heure choisie</option>
              <option value="before">Quelques heures avant</option>
            </Select>
          )}
        </Field>
        {reminder?.kind === "eve" && (
          <Field label="À">
            {(props) => (
              <Select
                {...props}
                value={String(reminder.hour)}
                onChange={(event) =>
                  set("messages", {
                    ...messages,
                    reminder: { kind: "eve", hour: Number(event.target.value) },
                  })
                }
              >
                {Array.from({ length: 16 }, (_, index) => index + 7).map((hour) => (
                  <option key={hour} value={hour}>
                    {hour} h
                  </option>
                ))}
              </Select>
            )}
          </Field>
        )}
        {reminder?.kind === "before" && (
          <Field label="Envoyé">
            {(props) => (
              <AffixInput
                {...props}
                inputMode="numeric"
                value={String(reminder.hours)}
                onChange={(event) =>
                  set("messages", {
                    ...messages,
                    reminder: { kind: "before", hours: whole(event.target.value) ?? 0 },
                  })
                }
                suffix="h avant"
              />
            )}
          </Field>
        )}
      </div>
      <Field label="Message après la séance">
        {(props) => (
          <textarea
            {...props}
            value={messages.after ?? ""}
            onChange={(event) => set("messages", { ...messages, after: text(event.target.value) })}
            maxLength={1000}
            placeholder="Merci d'être venu·e ! Tes pièces seront prêtes dans deux semaines."
            className={cn(textareaClasses(), "min-h-20")}
          />
        )}
      </Field>
    </>
  );
}

function DocumentsPanel({
  value,
  onChange,
}: {
  value: DocumentsModule;
  onChange: (value: DocumentsModule) => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [uploading, startUpload] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const files = value.files;
  return (
    <>
      <p className="text-sm leading-5 text-ink-muted">
        Règlement, plan d'accès, modèle d'autorisation parentale : en lien dans l'e-mail de
        confirmation et dans l'espace client. PDF, 10 Mo au plus.
      </p>
      {files.length > 0 && (
        <ul className="relative flex flex-col gap-2">
          <PresenceList>
            {files.map((file) => (
              <PresenceItem
                as="li"
                key={file.url}
                className="flex h-11 items-center gap-3 rounded-xl bg-field px-3"
              >
                <a
                  href={file.url}
                  target="_blank"
                  rel="noreferrer"
                  className="min-w-0 grow truncate text-sm font-semibold text-ink hover:text-link"
                >
                  {file.name}
                </a>
                <span className="shrink-0 font-mono text-xs text-ink-subtle">
                  {Math.max(1, Math.round(file.size / 1024))} Ko
                </span>
                <button
                  type="button"
                  onClick={() => onChange({ files: files.filter((entry) => entry !== file) })}
                  className={cn(textLinkClasses, "shrink-0 text-[13px]")}
                >
                  Retirer
                </button>
              </PresenceItem>
            ))}
          </PresenceList>
        </ul>
      )}
      <input
        ref={input}
        type="file"
        accept="application/pdf"
        className="sr-only"
        tabIndex={-1}
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = "";
          if (!file) return;
          setError(null);
          startUpload(async () => {
            const form = new FormData();
            form.set("file", file);
            const result = await uploadDocumentAction(form);
            if ("error" in result) return setError(result.error);
            onChange({ files: [...files, result.file] });
          });
        }}
      />
      {files.length < 5 && (
        <button
          type="button"
          disabled={uploading}
          aria-busy={uploading}
          onClick={() => input.current?.click()}
          className="flex items-center gap-1.5 self-start text-sm font-semibold leading-[18px] text-link hover:underline disabled:opacity-50"
        >
          <PlusIcon size={10} />
          {uploading ? "Envoi…" : "Ajouter un PDF"}
        </button>
      )}
      {error && <FieldError>{error}</FieldError>}
    </>
  );
}

/** Maquette 9.2 : catalogue des modules, groupé, avec recherche. */
function ModuleCatalog({
  modules,
  onPick,
  onClose,
  onCreateRule,
}: {
  modules: EventModules;
  onPick: (key: ModuleKey) => void;
  onClose: () => void;
  onCreateRule: () => void;
}) {
  const [query, setQuery] = useState("");
  const words = query
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .split(/\s+/)
    .filter(Boolean);
  const matches = (entry: ModuleDefinition) => {
    const haystack = `${entry.name} ${entry.description} ${entry.keywords}`
      .toLowerCase()
      .normalize("NFD")
      .replace(/\p{Diacritic}/gu, "");
    return words.every((word) => haystack.includes(word));
  };
  const groups = MODULE_GROUPS.map((group) => ({
    ...group,
    entries: MODULE_CATALOG.filter((entry) => entry.group === group.id && matches(entry)),
  })).filter((group) => group.entries.length > 0);

  return (
    <Dialog
      open
      onClose={onClose}
      size="xl"
      title="Ajouter un module"
      description="Chaque module ajoute ses réglages au type, et ses questions au formulaire d'inscription s'il en a besoin."
    >
      <div className="flex flex-col gap-7">
        <SearchInput
          label="Chercher un module"
          size="sm"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Chercher : acompte, rendez-vous, autorisation parentale…"
        />
        {groups.length === 0 && (
          <p className="text-sm text-ink-muted">
            Aucun module ne correspond. Pour le reste, crée une règle « si… alors… ».
          </p>
        )}
        <div className="reveal-group flex flex-col gap-7">
          {groups.map((group) => (
            <section key={group.id} className="flex flex-col gap-2.5">
              <h3 className="text-xs font-bold uppercase leading-4 tracking-[0.06em] text-ink-subtle">
                {group.label}
              </h3>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {group.entries.map((entry) => {
                  const active = !entry.soon && modules[entry.key as ModuleKey] !== undefined;
                  return (
                    <button
                      key={entry.key}
                      type="button"
                      disabled={entry.soon !== undefined}
                      onClick={() => onPick(entry.key as ModuleKey)}
                      className={cn(
                        "press flex flex-col gap-1 rounded-2xl border px-4 py-3.5 text-left",
                        active
                          ? "border-field bg-field"
                          : "border-bg hover:border-line-strong hover:bg-band",
                        "disabled:opacity-55 disabled:hover:border-bg disabled:hover:bg-transparent",
                      )}
                    >
                      <span className="flex items-center justify-between gap-3">
                        <span className="text-[15px] font-semibold leading-5 text-ink">
                          {entry.name}
                        </span>
                        {active && (
                          <span className="text-xs font-semibold leading-4 text-success">
                            Active
                          </span>
                        )}
                        {entry.soon && (
                          <span className="text-xs font-semibold leading-4 text-ink-subtle">
                            Bientôt
                          </span>
                        )}
                      </span>
                      <span className="text-[13px] leading-[17px] text-ink-muted">
                        {entry.description}
                      </span>
                    </button>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
        <div className="flex flex-col gap-4 rounded-[20px] bg-ink px-6 py-[22px] sm:flex-row sm:items-center sm:gap-6">
          <div className="flex grow flex-col gap-1.5">
            <p className="text-xs font-bold uppercase leading-4 tracking-[0.06em] text-on-ink-muted">
              Sur mesure
            </p>
            <p className="text-xl font-semibold leading-6 text-white">Règles « si… alors… »</p>
            <p className="text-sm leading-[19px] text-on-ink-soft">
              Pour tout ce qu'aucun module ne fait. Si l'âge est sous 16 ans, demander
              l'autorisation parentale. Si le tarif est réduit, demander un justificatif. Si moins
              de 4 inscrits à J-2, annuler et prévenir.
            </p>
          </div>
          <Button variant="inverse" onClick={onCreateRule} className="self-start sm:self-center">
            Créer une règle
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
