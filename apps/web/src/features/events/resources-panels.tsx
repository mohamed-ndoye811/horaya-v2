import type { EquipmentNeed, EventModules, LocationMode } from "@horaya/core";
import { PresenceItem, PresenceList } from "@/components/motion/presence";
import { Swap } from "@/components/motion/swap";
import { textLinkClasses } from "@/components/ui/button";
import { Field, inputClasses } from "@/components/ui/field";
import { CloseIcon, PlusIcon } from "@/components/ui/icons";
import { Select } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/cn";

/** Ce que les panneaux « Ressources » ont besoin de savoir de l'espace. */
export interface ResourcesContext {
  itemTypes: Array<{ id: string; name: string }>;
  members: Array<{ id: string; name: string }>;
}

type Set<K extends "equipment" | "location" | "staff"> = (key: K, value: EventModules[K]) => void;

const newNeedId = () => `besoin-${Math.random().toString(36).slice(2, 8)}`;

/** Maquette 9.1, ligne « Matériel » : un besoin par ligne (matériel, par place, obligatoire, qui choisit). */
export function EquipmentPanel({
  modules,
  set,
  context,
}: {
  modules: EventModules;
  set: Set<"equipment">;
  context: ResourcesContext;
}) {
  const needs = modules.equipment?.needs ?? [];
  const update = (next: EquipmentNeed[]) => set("equipment", { needs: next });
  const patch = (id: string, change: Partial<EquipmentNeed>) =>
    update(needs.map((need) => (need.id === id ? { ...need, ...change } : need)));

  if (context.itemTypes.length === 0) {
    return (
      <p className="text-sm leading-5 text-ink-muted">
        Ajoute d'abord du matériel (page Matériel) : chaque article appartient à un type, par
        exemple « Tours de potier ».
      </p>
    );
  }
  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm leading-5 text-ink-muted">
        Réservé avec chaque place, jamais donné deux fois. Quand l'élève choisit, il voit seulement
        les exemplaires libres.
      </p>
      <div className="relative flex flex-col gap-2">
        <PresenceList>
          {needs.map((need) => (
            <PresenceItem key={need.id}>
              <div className="grid gap-3 rounded-xl bg-field p-3 sm:grid-cols-[minmax(0,1.4fr)_96px_minmax(0,1fr)_minmax(0,1.2fr)_28px] sm:items-end">
                <Field label="Matériel">
                  {(props) => (
                    <Select
                      {...props}
                      variant="compact"
                      value={need.itemTypeId}
                      onChange={(event) => patch(need.id, { itemTypeId: event.target.value })}
                    >
                      <option value="">Choisis un type…</option>
                      {context.itemTypes.map((type) => (
                        <option key={type.id} value={type.id}>
                          {type.name}
                        </option>
                      ))}
                    </Select>
                  )}
                </Field>
                <Field label="Par place">
                  {(props) => (
                    <input
                      {...props}
                      inputMode="numeric"
                      value={need.perSeat}
                      onChange={(event) =>
                        patch(need.id, { perSeat: Number(event.target.value) || 1 })
                      }
                      className={cn(inputClasses(), "h-10")}
                    />
                  )}
                </Field>
                <Field label="Pour l'élève">
                  {(props) => (
                    <Select
                      {...props}
                      variant="compact"
                      value={need.required ? "required" : "optional"}
                      onChange={(event) =>
                        patch(need.id, { required: event.target.value === "required" })
                      }
                    >
                      <option value="required">Obligatoire</option>
                      <option value="optional">Au choix</option>
                    </Select>
                  )}
                </Field>
                <Field label="Qui choisit">
                  {(props) => (
                    <Select
                      {...props}
                      variant="compact"
                      value={need.chooser}
                      onChange={(event) =>
                        patch(need.id, { chooser: event.target.value as EquipmentNeed["chooser"] })
                      }
                    >
                      <option value="workshop">L'atelier l'attribue</option>
                      <option value="student">L'élève, en ligne</option>
                    </Select>
                  )}
                </Field>
                <button
                  type="button"
                  aria-label="Retirer ce besoin"
                  onClick={() => update(needs.filter((entry) => entry.id !== need.id))}
                  className="press flex size-7 items-center justify-center self-center rounded-full text-ink-muted hover:bg-surface hover:text-ink sm:self-end sm:mb-2"
                >
                  <CloseIcon size={12} />
                </button>
              </div>
            </PresenceItem>
          ))}
        </PresenceList>
      </div>
      <button
        type="button"
        onClick={() =>
          update([
            ...needs,
            {
              id: newNeedId(),
              itemTypeId: "",
              perSeat: 1,
              required: true,
              chooser: "workshop",
            },
          ])
        }
        className={cn(textLinkClasses, "flex items-center gap-1.5 self-start text-meta")}
      >
        <PlusIcon size={11} />
        Ajouter du matériel
      </button>
    </div>
  );
}

const LOCATION_MODE_LABELS: Record<LocationMode, string> = {
  venue: "À l'atelier",
  online: "En ligne",
  client: "Chez le client",
};

export function LocationPanel({ modules, set }: { modules: EventModules; set: Set<"location"> }) {
  const location = modules.location ?? { mode: "venue" as const };
  return (
    <div className="flex flex-col gap-4">
      <Field label="Où ça se passe" group>
        {() => (
          <div className="flex flex-wrap gap-2">
            {(Object.keys(LOCATION_MODE_LABELS) as LocationMode[]).map((mode) => (
              <button
                key={mode}
                type="button"
                aria-pressed={location.mode === mode}
                onClick={() => set("location", { mode })}
                className={cn(
                  "press h-10 rounded-full px-4 text-sm font-semibold transition-colors",
                  location.mode === mode
                    ? "bg-ink text-on-ink"
                    : "bg-field text-ink hover:bg-line-faint",
                )}
              >
                {LOCATION_MODE_LABELS[mode]}
              </button>
            ))}
          </div>
        )}
      </Field>
      <Swap value={location.mode}>
        {location.mode === "venue" ? (
          <Field
            label="Autre adresse"
            hint={
              <p className="text-meta text-ink-muted">
                Laisse vide pour l'adresse de l'espace (réglages).
              </p>
            }
          >
            {(props) => (
              <input
                {...props}
                value={location.address ?? ""}
                maxLength={300}
                onChange={(event) =>
                  set("location", { mode: "venue", address: event.target.value || undefined })
                }
                placeholder="Adresse de l'espace"
                className={inputClasses()}
              />
            )}
          </Field>
        ) : location.mode === "online" ? (
          <Field
            label="Lien de la visio"
            hint={
              <p className="text-meta text-ink-muted">
                Envoyé dans la confirmation et le rappel, jamais affiché avant l'inscription. Tu
                peux le changer sur chaque événement.
              </p>
            }
          >
            {(props) => (
              <input
                {...props}
                type="url"
                value={location.onlineUrl ?? ""}
                onChange={(event) =>
                  set("location", { mode: "online", onlineUrl: event.target.value || undefined })
                }
                placeholder="https://"
                className={inputClasses()}
              />
            )}
          </Field>
        ) : (
          <p className="text-sm leading-5 text-ink-muted">
            Le formulaire d'inscription demande l'adresse où vous vous rendez. Elle apparaît sur la
            fiche de la réservation.
          </p>
        )}
      </Swap>
    </div>
  );
}

export function StaffPanel({
  modules,
  set,
  context,
}: {
  modules: EventModules;
  set: Set<"staff">;
  context: ResourcesContext;
}) {
  const staff = modules.staff ?? {};
  const chosen = staff.memberIds ?? [];
  const toggle = (id: string) =>
    set("staff", {
      ...staff,
      memberIds: chosen.includes(id) ? chosen.filter((entry) => entry !== id) : [...chosen, id],
    });
  return (
    <div className="flex flex-col gap-4">
      <Field label="Membres proposés" group>
        {() => (
          <div className="flex flex-wrap gap-2">
            {context.members.map((member) => (
              <button
                key={member.id}
                type="button"
                aria-pressed={chosen.includes(member.id)}
                onClick={() => toggle(member.id)}
                className={cn(
                  "press h-9 rounded-full px-3.5 text-sm font-semibold transition-colors",
                  chosen.includes(member.id)
                    ? "bg-ink text-on-ink"
                    : "bg-field text-ink hover:bg-line-faint",
                )}
              >
                {member.name}
              </button>
            ))}
          </div>
        )}
      </Field>
      <p className="text-meta leading-[18px] text-ink-muted">
        {chosen.length === 0
          ? "Aucun membre coché : toute l'équipe peut être choisie."
          : "L'intervenant se choisit sur chaque événement, parmi ces membres."}{" "}
        Il reçoit la notification des nouvelles inscriptions de ses événements.
      </p>
      <Switch
        checked={staff.showOnPublicPage === true}
        onChange={(event) => set("staff", { ...staff, showOnPublicPage: event.target.checked })}
        label="Afficher son prénom sur la page publique"
      />
    </div>
  );
}
