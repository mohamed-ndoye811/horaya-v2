import {
  type Closure,
  type DurationModule,
  type DurationOption,
  durationLabel,
  durationTitle,
  type EventModules,
  type ModuleKey,
  type SlotsModule,
  type TimeRange,
} from "@horaya/core";
import { useState } from "react";
import { PresenceItem, PresenceList } from "@/components/motion/presence";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Checkbox, Field, FieldError, inputClasses } from "@/components/ui/field";
import { ChevronRight, CloseIcon, PlusIcon } from "@/components/ui/icons";
import { Select } from "@/components/ui/select";
import { InfoLine, pillClasses, SettingRow, SettingRows } from "@/components/ui/setting-rows";
import { Stepper } from "@/components/ui/stepper";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/cn";
import { formatMoney } from "@/lib/format";
import { centsToInput, parseEuroToCents } from "@/lib/money";

/** Modules « Le temps » (lot 37, maquettes 9.5 et 9.7) : créneaux, durée au choix, stage. */

type Setter = <K extends ModuleKey>(key: K, value: EventModules[K]) => void;

const WEEKDAYS = ["Lun.", "Mar.", "Mer.", "Jeu.", "Ven.", "Sam.", "Dim."];
const INTERVALS = [15, 20, 30, 45, 60, 90, 120];
const BREAKS = [0, 5, 10, 15, 20, 30, 45, 60];
const OPENS = [7, 14, 30, 60, 90, 180, 365];
const CLOSES = [0, 1, 2, 6, 12, 24, 48, 72];

const withValue = (list: number[], value: number | undefined) =>
  value === undefined || list.includes(value) ? list : [...list, value].sort((a, b) => a - b);
const everyLabel = (minutes: number) =>
  minutes === 60 ? "toutes les heures" : `toutes les ${durationLabel(minutes)}`;
const closesLabel = (hours: number) =>
  hours === 0 ? "jusqu'au début" : `jusqu'à ${hours} h avant`;
const shortDate = (value: string) =>
  new Date(`${value}T12:00:00Z`)
    .toLocaleDateString("fr-FR", { day: "numeric", month: "short", timeZone: "UTC" })
    .replace(/\.$/, ".");
const names = (list: string[]) =>
  list.length <= 1 ? (list[0] ?? "") : `${list.slice(0, -1).join(", ")} et ${list.at(-1)}`;

/** Plage suivante d'une journée : après la dernière, deux heures (14:00–18:00 si aucune). */
function nextRange(ranges: TimeRange[]): TimeRange {
  const last = ranges.at(-1);
  if (!last) return { start: "14:00", end: "18:00" };
  const [hour = 0, minute = 0] = last.end.split(":").map(Number);
  const start = Math.min(hour + 1, 21);
  const pad = (value: number) => String(value).padStart(2, "0");
  return {
    start: `${pad(start)}:${pad(minute)}`,
    end: `${pad(Math.min(start + 2, 23))}:${pad(minute)}`,
  };
}

/* ---------- Créneaux ---------- */

export function SlotsPanel({
  modules,
  set,
  members,
}: {
  modules: EventModules;
  set: Setter;
  members: Array<{ id: string; name: string }>;
}) {
  const slots = modules.slots as SlotsModule;
  const update = (patch: Partial<SlotsModule>) => set("slots", { ...slots, ...patch });
  const setDay = (day: number, ranges: TimeRange[]) =>
    update({ weekly: slots.weekly.map((entry, index) => (index === day ? ranges : entry)) });
  const [closing, setClosing] = useState(false);
  const [staffOpen, setStaffOpen] = useState(false);
  const chosen = (slots.memberIds ?? [])
    .map((id) => members.find((member) => member.id === id))
    .filter((member) => member !== undefined);

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <div className="flex min-w-0 flex-col gap-3.5">
        <div className="flex flex-col gap-0.5">
          <p className="text-sm font-semibold leading-[18px] text-ink">Tes disponibilités</p>
          <p className="text-[13px] leading-[17px] text-ink-muted">
            Chaque semaine, les créneaux sont découpés dans ces plages
          </p>
        </div>
        <div className="flex flex-col gap-1">
          {slots.weekly.map((ranges, day) => (
            <div key={WEEKDAYS[day]} className="flex min-h-[34px] flex-wrap items-center gap-1.5">
              <span
                className={cn(
                  "w-10 shrink-0 text-[13px] font-semibold leading-4",
                  ranges.length ? "text-ink" : "text-ink-faint",
                )}
              >
                {WEEKDAYS[day]}
              </span>
              {ranges.length === 0 && (
                <span className="text-[13px] leading-4 text-ink-faint">Fermé</span>
              )}
              {ranges.map((range, index) => (
                // biome-ignore lint/suspicious/noArrayIndexKey: la plage se modifie en place (clé stable pendant la saisie).
                <span key={index} className={pillClasses()}>
                  <input
                    type="time"
                    aria-label={`${WEEKDAYS[day]} début`}
                    value={range.start}
                    onChange={(event) =>
                      setDay(
                        day,
                        ranges.map((entry, at) =>
                          at === index ? { ...entry, start: event.target.value } : entry,
                        ),
                      )
                    }
                    className="w-[46px] bg-transparent font-semibold outline-none"
                  />
                  –
                  <input
                    type="time"
                    aria-label={`${WEEKDAYS[day]} fin`}
                    value={range.end}
                    onChange={(event) =>
                      setDay(
                        day,
                        ranges.map((entry, at) =>
                          at === index ? { ...entry, end: event.target.value } : entry,
                        ),
                      )
                    }
                    className="w-[46px] bg-transparent font-semibold outline-none"
                  />
                  <button
                    type="button"
                    aria-label="Retirer la plage"
                    onClick={() =>
                      setDay(
                        day,
                        ranges.filter((_, at) => at !== index),
                      )
                    }
                    className="flex size-4 items-center justify-center text-ink-faint hover:text-ink"
                  >
                    <CloseIcon size={8} />
                  </button>
                </span>
              ))}
              {ranges.length < 6 && (
                <button
                  type="button"
                  aria-label={`Ajouter une plage le ${WEEKDAYS[day]}`}
                  onClick={() => setDay(day, [...ranges, nextRange(ranges)])}
                  className="flex size-[26px] shrink-0 items-center justify-center rounded-lg text-ink-subtle hover:bg-field hover:text-ink"
                >
                  <PlusIcon size={10} />
                </button>
              )}
            </div>
          ))}
        </div>
        <div className="flex flex-col gap-1.5 pt-1">
          <p className="text-sm font-semibold leading-[18px] text-ink">Fermetures</p>
          <div className="flex flex-wrap items-center gap-2">
            {(slots.closures ?? []).map((closure, index) => (
              <span
                key={`${closure.from}-${closure.to}-${closure.label ?? ""}`}
                className={pillClasses()}
              >
                {closure.from === closure.to
                  ? shortDate(closure.from)
                  : `${shortDate(closure.from)} → ${shortDate(closure.to)}`}
                {closure.label && (
                  <span className="font-normal text-ink-muted">{closure.label}</span>
                )}
                <button
                  type="button"
                  aria-label="Retirer la fermeture"
                  onClick={() =>
                    update({ closures: (slots.closures ?? []).filter((_, at) => at !== index) })
                  }
                  className="flex size-4 items-center justify-center text-ink-faint hover:text-ink"
                >
                  <CloseIcon size={8} />
                </button>
              </span>
            ))}
            <button
              type="button"
              onClick={() => setClosing(true)}
              className="text-[13px] font-semibold leading-4 text-link hover:underline"
            >
              + Ajouter
            </button>
          </div>
        </div>
      </div>

      <div className="flex min-w-0 flex-col gap-2.5">
        <SettingRows>
          <SettingRow title="Rythme" description="Quand partent les créneaux">
            <Select
              variant="pill"
              aria-label="Intervalle entre deux départs"
              value={String(slots.intervalMinutes)}
              onChange={(event) => update({ intervalMinutes: Number(event.target.value) })}
            >
              {withValue(INTERVALS, slots.intervalMinutes).map((minutes) => (
                <option key={minutes} value={minutes}>
                  {everyLabel(minutes)}
                </option>
              ))}
            </Select>
            <Select
              variant="pill"
              aria-label="Pause entre deux élèves"
              value={String(slots.breakMinutes ?? 0)}
              onChange={(event) =>
                update({ breakMinutes: Number(event.target.value) || undefined })
              }
            >
              {withValue(BREAKS, slots.breakMinutes).map((minutes) => (
                <option key={minutes} value={minutes}>
                  {minutes === 0 ? "sans pause" : `pause ${minutes} min`}
                </option>
              ))}
            </Select>
          </SettingRow>
          <SettingRow title="Places par créneau" description="1 = cours particulier">
            <Stepper
              size="pill"
              label="Places par créneau"
              value={slots.seatsPerSlot ?? 1}
              min={1}
              max={20}
              onChange={(seatsPerSlot) => update({ seatsPerSlot })}
            />
          </SettingRow>
          <SettingRow title="Réservable" description="Quand l'élève peut réserver">
            <Select
              variant="pill"
              aria-label="Réservable au plus tôt"
              value={String(slots.opensDaysBefore ?? "")}
              onChange={(event) =>
                update({ opensDaysBefore: Number(event.target.value) || undefined })
              }
            >
              <option value="">sans limite</option>
              {withValue(OPENS, slots.opensDaysBefore).map((days) => (
                <option key={days} value={days}>
                  dès J-{days}
                </option>
              ))}
            </Select>
            <Select
              variant="pill"
              aria-label="Réservable au plus tard"
              value={String(slots.closesHoursBefore ?? 0)}
              onChange={(event) =>
                update({ closesHoursBefore: Number(event.target.value) || undefined })
              }
            >
              {withValue(CLOSES, slots.closesHoursBefore).map((hours) => (
                <option key={hours} value={hours}>
                  {closesLabel(hours)}
                </option>
              ))}
            </Select>
          </SettingRow>
          <SettingRow
            title="Intervenants"
            description={
              chosen.length
                ? `${names(chosen.map((member) => member.name.split(" ")[0] ?? member.name))} · ${
                    slots.chooseStaff ? "l'élève choisit avec qui" : "le premier libre"
                  }`
                : "Aucun : le créneau ne dépend de personne"
            }
          >
            <button
              type="button"
              onClick={() => setStaffOpen(true)}
              className={cn(
                pillClasses(chosen.length ? "rounded" : "square"),
                "hover:border-line-strong",
              )}
            >
              {chosen.length > 0 && (
                <span className="flex items-center">
                  {chosen.slice(0, 4).map((member) => (
                    <span
                      key={member.id}
                      className="-ml-1.5 rounded-full border-2 border-field first:ml-0"
                    >
                      <Avatar name={member.name} size="mini" />
                    </span>
                  ))}
                </span>
              )}
              Modifier
              <ChevronRight className="h-2.5 w-2 text-ink-muted" />
            </button>
          </SettingRow>
        </SettingRows>
        <InfoLine>
          {modules.duration
            ? "La durée d'un créneau suit la durée choisie par l'élève."
            : "Un créneau dure la durée par défaut du type."}{" "}
          Un créneau réservé bloque aussi le matériel et l'intervenant.
        </InfoLine>
      </div>

      {closing && (
        <ClosureDialog
          onClose={() => setClosing(false)}
          onSave={(closure) => {
            update({ closures: [...(slots.closures ?? []), closure] });
            setClosing(false);
          }}
        />
      )}
      {staffOpen && (
        <Dialog
          open
          onClose={() => setStaffOpen(false)}
          density="compact"
          title="Intervenants"
          description="Les membres qui donnent ces cours. Un créneau n'est proposé que si l'un d'eux est libre."
          footer={
            <Button size="sm" onClick={() => setStaffOpen(false)}>
              Terminé
            </Button>
          }
        >
          <div className="flex flex-col gap-3">
            {members.map((member) => {
              const ids = slots.memberIds ?? [];
              return (
                <Checkbox
                  key={member.id}
                  label={member.name}
                  checked={ids.includes(member.id)}
                  onChange={(event) => {
                    const next = event.target.checked
                      ? [...ids, member.id]
                      : ids.filter((id) => id !== member.id);
                    update({ memberIds: next.length ? next : undefined });
                  }}
                />
              );
            })}
            <SettingRows>
              <SettingRow
                title="L'élève choisit avec qui"
                description="Sinon, le premier intervenant libre est attribué"
              >
                <Switch
                  hideLabel
                  label="L'élève choisit avec qui"
                  checked={slots.chooseStaff ?? false}
                  onChange={(event) => update({ chooseStaff: event.target.checked || undefined })}
                />
              </SettingRow>
            </SettingRows>
          </div>
        </Dialog>
      )}
    </div>
  );
}

function ClosureDialog({
  onClose,
  onSave,
}: {
  onClose: () => void;
  onSave: (closure: Closure) => void;
}) {
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [label, setLabel] = useState("");
  const [error, setError] = useState<string | null>(null);
  return (
    <Dialog
      open
      onClose={onClose}
      density="compact"
      title="Ajouter une fermeture"
      description="Aucun créneau n'est proposé ces jours-là."
      footer={
        <div className="flex w-full flex-col gap-2">
          {error && <FieldError>{error}</FieldError>}
          <Button
            size="sm"
            onClick={() => {
              const end = to || from;
              if (!from) return setError("Choisis le premier jour");
              if (end < from) return setError("La fin précède le début");
              onSave({ from, to: end, ...(label.trim() && { label: label.trim() }) });
            }}
          >
            Ajouter
          </Button>
        </div>
      }
    >
      <div className="grid gap-3 sm:grid-cols-3">
        <Field label="Du">
          {(props) => (
            <input
              {...props}
              type="date"
              value={from}
              onChange={(event) => setFrom(event.target.value)}
              className={inputClasses("xs")}
            />
          )}
        </Field>
        <Field label="Au (inclus)">
          {(props) => (
            <input
              {...props}
              type="date"
              value={to}
              min={from}
              onChange={(event) => setTo(event.target.value)}
              className={inputClasses("xs")}
            />
          )}
        </Field>
        <Field label="Pourquoi">
          {(props) => (
            <input
              {...props}
              value={label}
              maxLength={40}
              onChange={(event) => setLabel(event.target.value)}
              placeholder="vacances"
              className={inputClasses("xs")}
            />
          )}
        </Field>
      </div>
    </Dialog>
  );
}

/* ---------- Durée au choix ---------- */

const MINUTES = [30, 45, 60, 90, 120, 150, 180, 240, 300, 360, 420, 480];

/** Identifiant d'une nouvelle durée, à partir de son nom (« 2 h » → « 2-h »). */
function durationId(label: string, taken: string[]): string {
  const base =
    label
      .toLowerCase()
      .normalize("NFD")
      .replace(/\p{Diacritic}/gu, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 30) || "duree";
  let id = base;
  for (let index = 2; taken.includes(id); index++) id = `${base}-${index}`;
  return id;
}

export function DurationPanel({ modules, set }: { modules: EventModules; set: Setter }) {
  const duration = modules.duration as DurationModule;
  const [editing, setEditing] = useState<DurationOption | "new" | null>(null);
  const defaultId = duration.defaultId ?? duration.options[0]?.id;
  const save = (option: DurationOption, isDefault: boolean, previous?: DurationOption) => {
    const options = previous
      ? duration.options.map((entry) => (entry.id === previous.id ? option : entry))
      : [...duration.options, option];
    set("duration", {
      options,
      defaultId: isDefault ? option.id : defaultId === previous?.id ? option.id : defaultId,
    });
    setEditing(null);
  };
  return (
    <div className="flex flex-col gap-1.5">
      <ul className="relative flex flex-col gap-1.5">
        <PresenceList>
          {duration.options.map((option) => (
            <PresenceItem
              as="li"
              key={option.id}
              className="flex items-center gap-3 rounded-xl bg-field px-3 py-2.5"
            >
              <button
                type="button"
                onClick={() => setEditing(option)}
                className="flex min-w-0 grow flex-col gap-px text-left"
              >
                <span className="flex items-center gap-2">
                  <span className="text-sm font-semibold leading-[18px] text-ink">
                    {durationTitle(option)} · {formatMoney(option.priceCents)}
                  </span>
                  {option.id === defaultId && (
                    <span className="rounded-full bg-success-bg px-[7px] py-px text-[11px] font-semibold leading-[15px] text-success">
                      Par défaut
                    </span>
                  )}
                </span>
                {option.description && (
                  <span className="text-[13px] leading-[17px] text-ink-muted">
                    {option.description}
                  </span>
                )}
              </button>
              {duration.options.length > 1 && (
                <button
                  type="button"
                  aria-label={`Retirer ${option.label}`}
                  onClick={() => {
                    const options = duration.options.filter((entry) => entry.id !== option.id);
                    set("duration", {
                      options,
                      defaultId: defaultId === option.id ? options[0]?.id : defaultId,
                    });
                  }}
                  className="flex size-6 shrink-0 items-center justify-center text-ink-faint hover:text-ink"
                >
                  <CloseIcon size={9} />
                </button>
              )}
            </PresenceItem>
          ))}
        </PresenceList>
      </ul>
      {duration.options.length < 10 && (
        <button
          type="button"
          onClick={() => setEditing("new")}
          className="self-start px-0.5 pt-1 text-[13px] font-semibold leading-4 text-link hover:underline"
        >
          + Ajouter une durée
        </button>
      )}
      {editing && (
        <DurationDialog
          option={editing === "new" ? null : editing}
          isDefault={editing !== "new" && editing.id === defaultId}
          taken={duration.options.map((option) => option.id)}
          onClose={() => setEditing(null)}
          onSave={(option, isDefault) =>
            save(option, isDefault, editing === "new" ? undefined : editing)
          }
        />
      )}
    </div>
  );
}

function DurationDialog({
  option,
  isDefault,
  taken,
  onClose,
  onSave,
}: {
  option: DurationOption | null;
  isDefault: boolean;
  taken: string[];
  onClose: () => void;
  onSave: (option: DurationOption, isDefault: boolean) => void;
}) {
  const [minutes, setMinutes] = useState(option?.minutes ?? 60);
  const [label, setLabel] = useState(option?.label ?? "");
  const [price, setPrice] = useState(option ? centsToInput(option.priceCents) : "");
  const [description, setDescription] = useState(option?.description ?? "");
  const [byDefault, setByDefault] = useState(isDefault);
  const [error, setError] = useState<string | null>(null);
  return (
    <Dialog
      open
      onClose={onClose}
      density="compact"
      title={option ? "Modifier la durée" : "Ajouter une durée"}
      footer={
        <div className="flex w-full flex-col gap-2">
          {error && <FieldError>{error}</FieldError>}
          <Button
            size="sm"
            onClick={() => {
              const name = label.trim() || durationLabel(minutes);
              if (price.trim() === "") return setError("Indique le prix de cette durée");
              onSave(
                {
                  id:
                    option?.id ??
                    durationId(
                      name,
                      taken.filter((id) => id !== option?.id),
                    ),
                  label: name,
                  minutes,
                  priceCents: parseEuroToCents(price),
                  ...(description.trim() && { description: description.trim() }),
                },
                byDefault,
              );
            }}
          >
            Enregistrer
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-3">
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="Durée">
            {(props) => (
              <Select
                {...props}
                variant="dense"
                value={String(minutes)}
                onChange={(event) => setMinutes(Number(event.target.value))}
              >
                {withValue(MINUTES, minutes).map((value) => (
                  <option key={value} value={value}>
                    {durationLabel(value)}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          <Field label="Nom">
            {(props) => (
              <input
                {...props}
                value={label}
                maxLength={40}
                onChange={(event) => setLabel(event.target.value)}
                placeholder={durationLabel(minutes)}
                className={inputClasses("xs")}
              />
            )}
          </Field>
          <Field label="Prix (€)">
            {(props) => (
              <input
                {...props}
                inputMode="decimal"
                value={price}
                onChange={(event) => setPrice(event.target.value)}
                placeholder="45"
                className={inputClasses("xs")}
              />
            )}
          </Field>
        </div>
        <Field label="Ce que ça comprend">
          {(props) => (
            <input
              {...props}
              value={description}
              maxLength={120}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="Découverte, repas compris…"
              className={inputClasses("xs")}
            />
          )}
        </Field>
        <Checkbox
          label="Durée choisie d'office"
          checked={byDefault}
          onChange={(event) => setByDefault(event.target.checked)}
        />
      </div>
    </Dialog>
  );
}

/* ---------- Plusieurs séances ---------- */

export function SessionsPanel({ modules, set }: { modules: EventModules; set: Setter }) {
  const sessions = modules.sessions ?? {};
  return (
    <div className="flex flex-col gap-2.5">
      <SettingRows>
        <SettingRow
          title="Inscription à une seule séance"
          description="Les élèves peuvent aussi réserver une date à l'unité"
        >
          <Switch
            hideLabel
            label="Inscription à une seule séance"
            checked={sessions.singleSession ?? false}
            onChange={(event) =>
              set("sessions", { ...sessions, singleSession: event.target.checked || undefined })
            }
          />
        </SettingRow>
        <SettingRow
          title="Même matériel à chaque séance"
          description="L'élève retrouve son poste d'une séance à l'autre"
        >
          <Switch
            hideLabel
            label="Même matériel à chaque séance"
            checked={sessions.sameEquipment ?? false}
            onChange={(event) =>
              set("sessions", { ...sessions, sameEquipment: event.target.checked || undefined })
            }
          />
        </SettingRow>
      </SettingRows>
      <InfoLine>
        Les séances (dates, horaires, sujet) se posent sur chaque stage, dans le formulaire
        d'événement. Le prix du type vaut pour tout le stage.
      </InfoLine>
    </div>
  );
}
