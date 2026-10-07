"use client";

import type { CalendarLinkFilter } from "@horaya/core";
import { useRouter } from "next/navigation";
import { useOptimistic, useState, useTransition } from "react";
import { CategorySwatch } from "@/components/ui/avatar";
import { StatusBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ChoiceCards } from "@/components/ui/choice-cards";
import { DataTable } from "@/components/ui/data-table";
import { Dialog } from "@/components/ui/dialog";
import { Checkbox, Field, inputClasses } from "@/components/ui/field";
import { FormAlert } from "@/components/ui/form-alert";
import { PlusIcon } from "@/components/ui/icons";
import { ActionMenu, type MenuItem } from "@/components/ui/menu";
import { Switch } from "@/components/ui/switch";
import { Tag } from "@/components/ui/tag";
import { useFormAction } from "@/lib/use-form-action";
import type { FormState } from "@/server/form-state";
import {
  deleteCalendarLinkAction,
  saveCalendarLinkAction,
  setCalendarLinkActiveAction,
} from "./actions";

export interface LinkRow {
  id: string;
  name: string;
  url: string;
  filterMode: CalendarLinkFilter;
  filterIds: string[];
  /** « Tous les événements », « Atelier, Séminaire », « 3 événements ». */
  summary: string;
  upcomingEvents: number;
  isActive: boolean;
}

export interface LinkChoices {
  types: Array<{ id: string; name: string; color: string }>;
  events: Array<{ id: string; title: string; date: string; inviteOnly: boolean; draft: boolean }>;
}

const MODES: Array<{ value: CalendarLinkFilter; label: string; description: string }> = [
  { value: "all", label: "Tous", description: "Tous les événements publiés" },
  { value: "event_types", label: "Par type", description: "Les événements de certains types" },
  { value: "events", label: "Par événement", description: "Une liste d'événements choisis" },
];

type Message = { tone: "success" | "danger"; text: string } | null;

function Toast({ message }: { message: Message }) {
  if (!message) return null;
  return (
    <div className="fixed right-6 bottom-6 z-50 max-w-sm" role="status">
      <FormAlert tone={message.tone}>{message.text}</FormAlert>
    </div>
  );
}

/** « Nouveau lien » dans l'en-tête de l'écran. */
export function NewLinkButton({ choices }: { choices: LinkChoices }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button icon={<PlusIcon />} onClick={() => setOpen(true)}>
        Nouveau lien
      </Button>
      {open && <LinkDialog link={null} choices={choices} onClose={() => setOpen(false)} />}
    </>
  );
}

/** Liste des liens : adresse à copier, ce qu'ils montrent, activation, modification. */
export function CalendarLinksTable({
  links,
  choices,
  canDelete,
}: {
  links: LinkRow[];
  choices: LinkChoices;
  canDelete: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<Message>(null);
  const [editing, setEditing] = useState<LinkRow | null>(null);
  const [deleting, setDeleting] = useState<LinkRow | null>(null);
  const flash = (next: Message) => {
    setMessage(next);
    setTimeout(() => setMessage(null), 3500);
  };
  const run = (action: () => Promise<FormState>, onDone?: () => void) =>
    startTransition(async () => {
      const result = await action();
      flash(
        result.error
          ? { tone: "danger", text: result.error }
          : result.success
            ? { tone: "success", text: result.success }
            : null,
      );
      if (!result.error) {
        onDone?.();
        router.refresh();
      }
    });
  const copy = (url: string) =>
    navigator.clipboard
      .writeText(url)
      .then(() => flash({ tone: "success", text: "Lien copié." }))
      .catch(() =>
        flash({ tone: "danger", text: "Copie impossible : ouvre le lien et copie l'adresse." }),
      );

  const menu = (row: LinkRow): MenuItem[] => [
    { label: "Copier le lien", onSelect: () => copy(row.url) },
    { label: "Ouvrir la page", href: row.url },
    { label: "Modifier", onSelect: () => setEditing(row) },
    ...(canDelete
      ? [{ label: "Supprimer", tone: "danger" as const, onSelect: () => setDeleting(row) }]
      : []),
  ];

  return (
    <>
      <DataTable
        label="Liens calendrier"
        rows={links}
        rowKey={(row) => row.id}
        minWidth={820}
        columns={[
          {
            key: "name",
            header: "Lien",
            cell: (row) => (
              <div className="flex min-w-0 flex-col gap-1">
                <button
                  type="button"
                  onClick={() => setEditing(row)}
                  className="truncate text-left text-base font-bold text-ink hover:underline"
                >
                  {row.name}
                </button>
                <span className="truncate font-mono text-[13px] font-medium text-ink-muted">
                  {row.url.replace(/^https?:\/\//, "")}
                </span>
              </div>
            ),
          },
          {
            key: "filter",
            header: "Montre",
            width: 260,
            cell: (row) => (
              <span className="line-clamp-2 text-sm font-semibold text-ink">{row.summary}</span>
            ),
          },
          {
            key: "upcoming",
            header: "À venir",
            width: 100,
            cell: (row) => (
              <span className="font-mono text-sm font-semibold text-ink">{row.upcomingEvents}</span>
            ),
          },
          {
            key: "active",
            header: "Statut",
            width: 170,
            cell: (row) => (
              <ActiveSwitch
                row={row}
                disabled={pending}
                onToggle={(isActive, setOptimistic) =>
                  run(async () => {
                    setOptimistic(isActive);
                    return setCalendarLinkActiveAction(row.id, isActive);
                  })
                }
              />
            ),
          },
          {
            key: "actions",
            header: <span className="sr-only">Actions</span>,
            width: 48,
            align: "right",
            cell: (row) => <ActionMenu label={`Actions pour ${row.name}`} items={menu(row)} />,
          },
        ]}
      />
      {editing && <LinkDialog link={editing} choices={choices} onClose={() => setEditing(null)} />}
      {deleting && (
        <Dialog
          open
          onClose={() => setDeleting(null)}
          title="Supprimer ce lien ?"
          description={`La page « ${deleting.name} » ne s'ouvrira plus. Les réservations déjà faites restent valables.`}
          footer={
            <>
              <Button variant="secondary" onClick={() => setDeleting(null)}>
                Garder
              </Button>
              <Button
                variant="danger"
                pending={pending}
                onClick={() =>
                  run(
                    () => deleteCalendarLinkAction(deleting.id),
                    () => setDeleting(null),
                  )
                }
              >
                Supprimer
              </Button>
            </>
          }
        />
      )}
      <Toast message={message} />
    </>
  );
}

/** Interrupteur « actif » : il bascule tout de suite, le serveur suit. */
function ActiveSwitch({
  row,
  disabled,
  onToggle,
}: {
  row: LinkRow;
  disabled: boolean;
  onToggle: (isActive: boolean, setOptimistic: (value: boolean) => void) => void;
}) {
  const [active, setActive] = useOptimistic(row.isActive);
  return (
    <div className="flex items-center gap-3">
      <Switch
        label={`Lien « ${row.name} » actif`}
        hideLabel
        checked={active}
        disabled={disabled}
        onChange={(event) => onToggle(event.target.checked, setActive)}
      />
      <StatusBadge tone={active ? "success" : "draft"}>
        {active ? "Actif" : "Désactivé"}
      </StatusBadge>
    </div>
  );
}

/** Création ou modification d'un lien : nom, puis ce qu'il montre. */
function LinkDialog({
  link,
  choices,
  onClose,
}: {
  link: LinkRow | null;
  choices: LinkChoices;
  onClose: () => void;
}) {
  const router = useRouter();
  const [mode, setMode] = useState<CalendarLinkFilter>(link?.filterMode ?? "event_types");
  const [selected, setSelected] = useState<Set<string>>(
    () => new Set(link && link.filterMode !== "all" ? link.filterIds : []),
  );
  const { state, onSubmit, pending } = useFormAction<FormState>(async (previous, form) => {
    const result = await saveCalendarLinkAction(link?.id ?? null, previous, form);
    if (result.success) {
      router.refresh();
      onClose();
    }
    return result;
  }, {});
  const errors = state.fieldErrors ?? {};

  const options =
    mode === "event_types"
      ? choices.types.map((type) => ({
          id: type.id,
          label: type.name,
          swatch: type.color,
          detail: null as string | null,
          tags: [] as string[],
        }))
      : choices.events.map((entry) => ({
          id: entry.id,
          label: entry.title,
          swatch: null as string | null,
          detail: entry.date,
          tags: [
            entry.inviteOnly ? "Sur invitation" : null,
            entry.draft ? "Brouillon" : null,
          ].filter((tag): tag is string => tag !== null),
        }));
  const allSelected = options.length > 0 && options.every((option) => selected.has(option.id));
  const changeMode = (next: string) => {
    setMode(next as CalendarLinkFilter);
    setSelected(new Set());
  };
  const toggle = (id: string, checked: boolean) =>
    setSelected((current) => {
      const next = new Set(current);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });

  return (
    <Dialog
      open
      size="lg"
      onClose={onClose}
      title={link ? "Modifier le lien" : "Nouveau lien calendrier"}
      description="Une page publique qui ne montre qu'une partie de tes événements. Un événement « Sur invitation » choisi ici devient réservable par ceux qui ont le lien."
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Annuler
          </Button>
          <Button type="submit" form="calendar-link-form" pending={pending}>
            {link ? "Enregistrer" : "Créer le lien"}
          </Button>
        </>
      }
    >
      <form id="calendar-link-form" onSubmit={onSubmit} className="flex flex-col gap-5">
        {state.error && !state.fieldErrors && <FormAlert>{state.error}</FormAlert>}
        <Field label="Nom du lien" required error={errors.name}>
          {(field) => (
            <input
              {...field}
              name="name"
              required
              maxLength={80}
              defaultValue={link?.name}
              placeholder="Ateliers de l'équipe Vidal"
              className={inputClasses()}
            />
          )}
        </Field>
        <Field label="Ce que montre le lien" group>
          {() => (
            <ChoiceCards
              name="filterMode"
              label="Ce que montre le lien"
              options={MODES}
              value={mode}
              onChange={changeMode}
            />
          )}
        </Field>
        {mode !== "all" && (
          <fieldset className="flex flex-col gap-2.5">
            <div className="flex items-center justify-between gap-3">
              <legend className="text-sm font-bold text-ink">
                {mode === "event_types" ? "Types d'événements" : "Événements à venir"} ·{" "}
                {selected.size} choisi{selected.size > 1 ? "s" : ""}
              </legend>
              {options.length > 0 && (
                <button
                  type="button"
                  onClick={() =>
                    setSelected(
                      allSelected ? new Set() : new Set(options.map((option) => option.id)),
                    )
                  }
                  className="text-sm font-bold text-ink underline decoration-1 underline-offset-[3px]"
                >
                  {allSelected ? "Tout décocher" : "Tout cocher"}
                </button>
              )}
            </div>
            {options.length === 0 ? (
              <p className="text-sm font-medium text-ink-muted">
                {mode === "event_types"
                  ? "Aucun type d'événement pour l'instant."
                  : "Aucun événement à venir pour l'instant."}
              </p>
            ) : (
              <ul className="flex max-h-72 flex-col overflow-y-auto border-[1.5px] border-ink-subtle bg-surface">
                {options.map((option) => (
                  <li
                    key={option.id}
                    className="flex items-center gap-3 border-b border-line-soft px-3.5 py-2.5 last:border-b-0"
                  >
                    <Checkbox
                      name="filterIds"
                      value={option.id}
                      checked={selected.has(option.id)}
                      onChange={(event) => toggle(option.id, event.target.checked)}
                      className="min-w-0 flex-1"
                      label={
                        <span className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
                          {option.swatch && <CategorySwatch color={option.swatch} />}
                          <span className="font-bold">{option.label}</span>
                          {option.detail && (
                            <span className="font-medium text-ink-muted">{option.detail}</span>
                          )}
                        </span>
                      }
                    />
                    {option.tags.map((tag) => (
                      <Tag key={tag} tone={tag === "Brouillon" ? "draft" : "outline"}>
                        {tag}
                      </Tag>
                    ))}
                  </li>
                ))}
              </ul>
            )}
            {errors.filterIds && (
              <p className="text-[13px] font-semibold text-danger">{errors.filterIds}</p>
            )}
          </fieldset>
        )}
      </form>
    </Dialog>
  );
}
