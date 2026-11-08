import { EVENT_TYPE_TEMPLATES, type EventTypeTemplate, MODULE_CATALOG } from "@horaya/core";
import { useState } from "react";
import { Swap } from "@/components/motion/swap";
import { ButtonLink, textLinkClasses } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Select } from "@/components/ui/select";
import { cn } from "@/lib/cn";
import { plural } from "@/lib/format";

/** Ce qu'un modèle règle déjà (pastilles de la carte). */
function templateChips(template: EventTypeTemplate): string[] {
  const asked = template.fields.filter((field) => field.scope !== "event").length;
  const described = template.fields.length - asked;
  const capacity = template.modules.places?.capacity;
  return [
    capacity ? plural(capacity, "place") : null,
    // Les autres modules du modèle, par leur nom (Liste d'attente, Annulation…).
    ...MODULE_CATALOG.filter(
      (module) => module.key !== "places" && module.key in template.modules,
    ).map((module) => module.name),
    described ? plural(described, "info") : null,
    asked ? plural(asked, "question") : null,
  ].filter((chip): chip is string => chip !== null);
}

/** Maquette 9.3 : nouveau type depuis un modèle, ou copie d'un type existant. */
export function TemplateDialog({
  types,
  onClose,
}: {
  types: Array<{ id: string; name: string }>;
  onClose: () => void;
}) {
  const [chosen, setChosen] = useState(EVENT_TYPE_TEMPLATES[0]?.id ?? "vide");
  const [duplicating, setDuplicating] = useState(false);
  const [source, setSource] = useState(types[0]?.id ?? "");
  const template = EVENT_TYPE_TEMPLATES.find((entry) => entry.id === chosen);

  return (
    <Dialog
      open
      onClose={onClose}
      size="xl"
      density="compact"
      title="Nouveau type"
      description="Pars d'un modèle : ses réglages et ses champs sont déjà prêts. Tu pourras tout changer ensuite."
      footer={
        <div className="flex w-full flex-wrap items-center justify-between gap-3">
          <Swap value={String(duplicating)} block>
            {duplicating ? (
              <div className="flex flex-wrap items-center gap-2">
                <Select
                  variant="dense"
                  aria-label="Type à dupliquer"
                  value={source}
                  onChange={(event) => setSource(event.target.value)}
                >
                  {types.map((type) => (
                    <option key={type.id} value={type.id}>
                      {type.name}
                    </option>
                  ))}
                </Select>
                <button
                  type="button"
                  onClick={() => setDuplicating(false)}
                  className={cn(textLinkClasses, "text-sm")}
                >
                  Plutôt un modèle
                </button>
              </div>
            ) : types.length > 0 ? (
              <button
                type="button"
                onClick={() => setDuplicating(true)}
                className={cn(textLinkClasses, "text-sm")}
              >
                Dupliquer un type existant
              </button>
            ) : (
              <span />
            )}
          </Swap>
          <div className="flex items-center gap-3">
            <span className="text-sm text-ink-muted">
              <Swap value={duplicating ? "copie" : chosen}>
                {duplicating ? "Copie du type choisi" : template && `« ${template.name} » choisi`}
              </Swap>
            </span>
            <ButtonLink
              href={
                duplicating
                  ? `/app/evenements/types?type=nouveau&depuis=${source}`
                  : `/app/evenements/types?type=nouveau&modele=${chosen}`
              }
              variant="primary"
              size="sm"
            >
              Continuer
            </ButtonLink>
          </div>
        </div>
      }
    >
      <div
        role="radiogroup"
        aria-label="Modèles"
        className={cn(
          "reveal-group grid grid-cols-1 gap-2 transition-opacity sm:grid-cols-2 lg:grid-cols-4",
          duplicating && "pointer-events-none opacity-40",
        )}
      >
        {EVENT_TYPE_TEMPLATES.map((entry) => {
          const empty = entry.id === "vide";
          return (
            <label
              key={entry.id}
              className={cn(
                "press flex flex-col gap-1.5 rounded-xl p-3 hover:bg-field",
                "has-checked:border-ink has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-ink",
                empty
                  ? "border-[1.5px] border-dashed border-line-strong has-checked:border-solid"
                  : "border border-line-soft has-checked:border-[1.5px]",
              )}
            >
              <input
                type="radio"
                name="template"
                value={entry.id}
                checked={chosen === entry.id}
                onChange={() => setChosen(entry.id)}
                className="sr-only"
              />
              <span
                aria-hidden="true"
                className={cn(
                  "size-5 rounded-md",
                  empty && "border-[1.5px] border-dashed border-ink-faint",
                )}
                style={empty ? undefined : { backgroundColor: entry.color }}
              />
              <span className="flex flex-col gap-[3px]">
                <span className="text-sm font-semibold leading-[18px] text-ink">{entry.name}</span>
                <span className="text-xs leading-4 text-ink-muted">{entry.description}</span>
              </span>
              {!empty && (
                <span className="flex flex-wrap gap-1">
                  {templateChips(entry).map((chip) => (
                    <span
                      key={chip}
                      className="rounded-md bg-field px-[7px] py-0.5 text-[11px] font-semibold leading-[15px] text-ink-muted"
                    >
                      {chip}
                    </span>
                  ))}
                </span>
              )}
            </label>
          );
        })}
      </div>
    </Dialog>
  );
}
