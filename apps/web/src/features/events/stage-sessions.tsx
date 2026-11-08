import type { PricingModule } from "@horaya/core";
import { useState } from "react";
import { PresenceItem, PresenceList } from "@/components/motion/presence";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Field, FieldError, inputClasses } from "@/components/ui/field";
import { CloseIcon } from "@/components/ui/icons";
import { InfoLine, PillInput, SettingRow, SettingRows } from "@/components/ui/setting-rows";
import { Switch } from "@/components/ui/switch";
import { parseCivilDate } from "@/lib/dates";

/** Une séance du stage telle que saisie (jour et heures murales de l'espace). */
export interface SessionDraft {
  date: string;
  start: string;
  end: string;
  topic: string;
}

/** « Sam. 14 nov. · 10:00 – 17:00 ». */
export function sessionDetails(session: SessionDraft): string {
  const day = parseCivilDate(session.date);
  const label = day
    ? new Date(Date.UTC(day.year, day.month - 1, day.day, 12))
        .toLocaleDateString("fr-FR", {
          weekday: "short",
          day: "numeric",
          month: "short",
          timeZone: "UTC",
        })
        .replace(/^./, (first) => first.toUpperCase())
    : "Date à choisir";
  return `${label} · ${session.start} – ${session.end}`;
}

/** Le même jour une semaine plus tard (« Répéter chaque semaine »). */
function weekAfter(date: string): string {
  const day = parseCivilDate(date);
  if (!day) return date;
  return new Date(Date.UTC(day.year, day.month - 1, day.day + 7)).toISOString().slice(0, 10);
}

/**
 * Maquette 9.7 : les séances d'un stage dans le formulaire d'événement, son prix (un petit
 * champ par tarif, pris du type) et ses deux réglages. Une liste sans colonnes : le sujet,
 * puis le jour et les heures, une pastille de numéro et une croix.
 */
export function StageSessions({
  sessions,
  onChange,
  pricing,
  prices,
  onPricesChange,
  price,
  onPriceChange,
  paid,
  singleSession,
  sameEquipment,
  onSettingsChange,
  hasEquipment,
  error,
}: {
  sessions: SessionDraft[];
  onChange: (sessions: SessionDraft[]) => void;
  pricing: PricingModule | null;
  prices: Record<string, string>;
  onPricesChange: (prices: Record<string, string>) => void;
  /** Sans module « Tarifs et options » : un seul prix. */
  price: string;
  onPriceChange: (price: string) => void;
  paid: boolean;
  singleSession: boolean;
  sameEquipment: boolean;
  onSettingsChange: (patch: { singleSession?: boolean; sameEquipment?: boolean }) => void;
  hasEquipment: boolean;
  error: string | undefined;
}) {
  const [editing, setEditing] = useState<number | "new" | null>(null);
  const last = sessions.at(-1);
  const count = sessions.length;
  return (
    <div className="flex flex-col gap-3.5">
      <input
        type="hidden"
        name="sessions"
        value={JSON.stringify(
          sessions.map(({ date, start, end, topic }) => ({ date, start, end, topic })),
        )}
      />
      <div className="flex flex-col gap-1.5">
        <ol className="relative flex flex-col gap-1.5">
          <PresenceList>
            {sessions.map((session, index) => (
              <PresenceItem
                as="li"
                // biome-ignore lint/suspicious/noArrayIndexKey: la position est le numéro de la séance.
                key={index}
                className="flex items-center gap-3 rounded-xl bg-field px-3 py-2.5"
              >
                <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-surface text-label font-bold leading-[14px] text-ink-muted">
                  {index + 1}
                </span>
                <button
                  type="button"
                  onClick={() => setEditing(index)}
                  className="flex min-w-0 grow flex-col gap-px text-left"
                >
                  <span className="truncate text-sm font-semibold leading-[18px] text-ink">
                    {session.topic || `Séance ${index + 1}`}
                  </span>
                  <span className="text-[13px] leading-[17px] text-ink-muted">
                    {sessionDetails(session)}
                  </span>
                </button>
                {count > 1 && (
                  <button
                    type="button"
                    aria-label={`Retirer la séance ${index + 1}`}
                    onClick={() => onChange(sessions.filter((_, at) => at !== index))}
                    className="flex size-6 shrink-0 items-center justify-center text-ink-faint hover:text-ink"
                  >
                    <CloseIcon size={9} />
                  </button>
                )}
              </PresenceItem>
            ))}
          </PresenceList>
        </ol>
        <div className="flex flex-wrap gap-x-4 gap-y-1 px-0.5 pt-1">
          <button
            type="button"
            onClick={() => setEditing("new")}
            className="text-[13px] font-semibold leading-4 text-link hover:underline"
          >
            + Ajouter une séance
          </button>
          {last && (
            <button
              type="button"
              onClick={() =>
                onChange([...sessions, { ...last, date: weekAfter(last.date), topic: "" }])
              }
              className="text-[13px] font-semibold leading-4 text-link hover:underline"
            >
              + Répéter chaque semaine
            </button>
          )}
        </div>
        {error && <FieldError>{error}</FieldError>}
      </div>

      <SettingRows>
        {paid && (
          <SettingRow
            title="Prix du stage"
            description={`Pour ${count > 1 ? `les ${count} séances` : "la séance"} · repris du type, modifiable ici`}
          >
            {pricing ? (
              pricing.rates.map((rate) => (
                <PillInput
                  key={rate.id}
                  label={rate.name}
                  suffix="€"
                  name={`prix.${rate.id}`}
                  inputMode="decimal"
                  aria-label={`Prix du stage : ${rate.name}`}
                  value={prices[rate.id] ?? ""}
                  onChange={(event) => onPricesChange({ ...prices, [rate.id]: event.target.value })}
                />
              ))
            ) : (
              <PillInput
                label="Prix"
                suffix="€"
                name="price"
                inputMode="decimal"
                aria-label="Prix du stage"
                value={price}
                onChange={(event) => onPriceChange(event.target.value)}
              />
            )}
          </SettingRow>
        )}
        <SettingRow
          title="Inscription à une seule séance"
          description="Les élèves peuvent aussi réserver une date à l'unité"
        >
          <Switch
            hideLabel
            name="singleSession"
            label="Inscription à une seule séance"
            checked={singleSession}
            onChange={(event) => onSettingsChange({ singleSession: event.target.checked })}
          />
        </SettingRow>
        {hasEquipment && (
          <SettingRow
            title="Même tour à chaque séance"
            description="L'élève retrouve son poste d'une séance à l'autre"
          >
            <Switch
              hideLabel
              name="sameEquipment"
              label="Même tour à chaque séance"
              checked={sameEquipment}
              onChange={(event) => onSettingsChange({ sameEquipment: event.target.checked })}
            />
          </SettingRow>
        )}
      </SettingRows>
      <InfoLine>
        Annuler une séance prévient les inscrits. Annuler le stage annule toutes ses séances, selon
        la règle d'annulation du type.
      </InfoLine>

      {editing !== null && (
        <SessionDialog
          session={
            editing === "new"
              ? {
                  date: last ? weekAfter(last.date) : "",
                  start: last?.start ?? "10:00",
                  end: last?.end ?? "17:00",
                  topic: "",
                }
              : (sessions[editing] as SessionDraft)
          }
          number={editing === "new" ? count + 1 : editing + 1}
          onClose={() => setEditing(null)}
          onSave={(session) => {
            onChange(
              editing === "new"
                ? [...sessions, session]
                : sessions.map((entry, at) => (at === editing ? session : entry)),
            );
            setEditing(null);
          }}
        />
      )}
    </div>
  );
}

function SessionDialog({
  session,
  number,
  onClose,
  onSave,
}: {
  session: SessionDraft;
  number: number;
  onClose: () => void;
  onSave: (session: SessionDraft) => void;
}) {
  const [draft, setDraft] = useState(session);
  const [error, setError] = useState<string | null>(null);
  const set = (patch: Partial<SessionDraft>) => setDraft((current) => ({ ...current, ...patch }));
  return (
    <Dialog
      open
      onClose={onClose}
      density="compact"
      title={`Séance ${number}`}
      footer={
        <div className="flex w-full flex-col gap-2">
          {error && <FieldError>{error}</FieldError>}
          <Button
            size="sm"
            onClick={() => {
              if (!parseCivilDate(draft.date)) return setError("Choisis le jour de la séance");
              if (draft.end <= draft.start) return setError("La fin doit suivre le début");
              onSave({ ...draft, topic: draft.topic.trim() });
            }}
          >
            Enregistrer
          </Button>
        </div>
      }
    >
      {/* Entrée dans un champ : pas d'envoi du formulaire de l'événement. */}
      {/* biome-ignore lint/a11y/noStaticElementInteractions: on bloque seulement l'envoi par Entrée. */}
      <div
        className="flex flex-col gap-3"
        onKeyDown={(event) => {
          if (event.key === "Enter" && event.target instanceof HTMLInputElement) {
            event.preventDefault();
          }
        }}
      >
        <Field label="Sujet">
          {(props) => (
            <input
              {...props}
              value={draft.topic}
              maxLength={120}
              onChange={(event) => set({ topic: event.target.value })}
              placeholder="Centrage et premières formes"
              className={inputClasses("xs")}
            />
          )}
        </Field>
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="Jour">
            {(props) => (
              <input
                {...props}
                type="date"
                value={draft.date}
                onChange={(event) => set({ date: event.target.value })}
                className={inputClasses("xs")}
              />
            )}
          </Field>
          <Field label="De">
            {(props) => (
              <input
                {...props}
                type="time"
                value={draft.start}
                onChange={(event) => set({ start: event.target.value })}
                className={inputClasses("xs")}
              />
            )}
          </Field>
          <Field label="À">
            {(props) => (
              <input
                {...props}
                type="time"
                value={draft.end}
                onChange={(event) => set({ end: event.target.value })}
                className={inputClasses("xs")}
              />
            )}
          </Field>
        </div>
      </div>
    </Dialog>
  );
}
