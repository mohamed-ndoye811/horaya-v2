import { FabLink } from "@/components/app/fab";
import { PageHeader } from "@/components/app/page-header";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { ChevronRight, PlusIcon } from "@/components/ui/icons";
import { cardShellClasses } from "@/components/ui/section";
import type { getEventTypes } from "@/functions/events";
import { cn } from "@/lib/cn";
import { formatMoney } from "@/lib/format";
import { Link } from "@/lib/navigation";
import { EventTypeForm, type EventTypeFormValues, TYPE_COLORS } from "./event-type-form";

function formatDuration(minutes: number | null): string {
  if (!minutes) return "—";
  if (minutes % 1440 === 0) return `${minutes / 1440} jour${minutes > 1440 ? "s" : ""}`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (hours === 0) return `${rest} min`;
  return rest ? `${hours} h ${rest}` : `${hours} h`;
}

function summary(type: {
  requiresApproval: boolean;
  customFields: unknown[];
  bookingRules: { waitlistEnabled?: boolean };
}): string {
  return [
    type.requiresApproval ? "Validation manuelle" : "Réservation automatique",
    type.bookingRules.waitlistEnabled ? "Liste d'attente" : null,
    type.customFields.length > 0
      ? `${type.customFields.length} champ${type.customFields.length > 1 ? "s" : ""} personnalisé${type.customFields.length > 1 ? "s" : ""}`
      : null,
  ]
    .filter(Boolean)
    .join(" · ");
}

/** Écran 16 : types d'événements, avec le panneau d'édition à droite. */
export function EventTypesPage({
  data,
  selected,
}: {
  data: Awaited<ReturnType<typeof getEventTypes>>;
  selected: string | undefined;
}) {
  const { types } = data;
  const editing = types.find((type) => type.id === selected);

  const panelValues: EventTypeFormValues | null = editing
    ? { ...editing }
    : selected === "nouveau"
      ? {
          id: null,
          name: "",
          color: TYPE_COLORS[types.length % TYPE_COLORS.length] ?? "#528D74",
          defaultDurationMinutes: null,
          defaultPriceCents: null,
          defaultCapacity: null,
          requiresApproval: false,
          customFields: [],
          bookingRules: {},
          eventCount: 0,
        }
      : null;

  return (
    <div className="flex flex-1 flex-col">
      <PageHeader
        eyebrow="Événements / Types"
        title="Types d'événements"
        subtitle={
          <>
            {types.length} type{types.length > 1 ? "s" : ""} ·{" "}
            <span className="text-ink">ils pré-remplissent tes nouveaux événements.</span>
          </>
        }
        actions={
          <div className="hidden lg:flex">
            <ButtonLink href="/app/evenements/types?type=nouveau" icon={<PlusIcon />}>
              Nouveau type
            </ButtonLink>
          </div>
        }
      />
      <div className="flex flex-1 flex-col gap-4 px-4 pb-4 lg:flex-row lg:items-start">
        {/* Sur mobile (M10), le formulaire d'un type remplace la liste. */}
        <div className={cn("min-w-0 flex-1", panelValues && "hidden lg:block")}>
          {types.length === 0 && !panelValues ? (
            <EmptyState
              title="Aucun type pour l'instant."
              description="Commence par les formats que tu proposes le plus : séminaire, atelier, réunion… Chacun a sa couleur dans le calendrier."
              actions={
                <ButtonLink href="/app/evenements/types?type=nouveau" arrow>
                  Créer mon premier type
                </ButtonLink>
              }
            />
          ) : (
            <>
              {/* Panneau ouvert : la liste reste en cartes jusqu'à xl (le tableau n'y tient pas). */}
              <ul
                aria-label="Types d'événements"
                className={cn(
                  "flex flex-col overflow-hidden rounded-3xl bg-surface",
                  panelValues ? "xl:hidden" : "lg:hidden",
                )}
              >
                {types.map((type) => (
                  <li key={type.id} className="border-b border-line-soft">
                    <Link
                      href={`/app/evenements/types?type=${type.id}`}
                      aria-current={type.id === selected ? "page" : undefined}
                      className={cn(
                        "flex items-center gap-3.5 px-4 py-4 text-ink hover:bg-band",
                        type.id === selected && "bg-band",
                      )}
                    >
                      <span
                        className="size-2.5 shrink-0 rounded-[3px]"
                        style={{ backgroundColor: type.color }}
                        aria-hidden="true"
                      />
                      <span className="flex min-w-0 flex-1 flex-col gap-1">
                        <span className="truncate text-base font-bold leading-5">{type.name}</span>
                        <span className="truncate text-[13px] font-medium leading-[17px] text-ink-muted">
                          {[formatDuration(type.defaultDurationMinutes), summary(type)]
                            .filter((part) => part && part !== "—")
                            .join(" · ")}
                        </span>
                      </span>
                      <span className="flex shrink-0 flex-col items-end gap-1">
                        <span className="text-base font-extrabold leading-5">
                          {type.defaultPriceCents ? formatMoney(type.defaultPriceCents) : "Gratuit"}
                        </span>
                        <span className="text-xs leading-4 text-ink-subtle">
                          {type.eventCount} évén.
                        </span>
                      </span>
                      <ChevronRight />
                    </Link>
                  </li>
                ))}
              </ul>
              <div className={cn("hidden", panelValues ? "xl:block" : "lg:block")}>
                <div className={cn(cardShellClasses, "overflow-hidden")}>
                  <table className="w-full min-w-[640px] table-fixed border-collapse">
                    <colgroup>
                      <col />
                      <col style={{ width: 110 }} />
                      <col style={{ width: 130 }} />
                      <col style={{ width: 120 }} />
                    </colgroup>
                    <thead>
                      <tr className="h-10 bg-band">
                        {["Type", "Durée", "Prix", "Événements"].map((label, index) => (
                          <th
                            key={label}
                            scope="col"
                            className={cn(
                              "px-3 text-xs font-bold text-ink-muted first:pl-5 last:pr-5",
                              index === 3 ? "text-right" : "text-left",
                            )}
                          >
                            {label}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {types.map((type) => {
                        const active = type.id === selected;
                        return (
                          <tr
                            key={type.id}
                            className={cn(
                              "relative h-[60px] border-t border-line-faint hover:bg-band",
                              active && "bg-band shadow-[inset_3px_0_0_var(--color-ink)]",
                            )}
                          >
                            <td className="px-3 pl-5">
                              <div className="flex items-center gap-3">
                                <span
                                  className="size-2.5 shrink-0 rounded-[3px]"
                                  style={{ backgroundColor: type.color }}
                                  aria-hidden="true"
                                />
                                <Link
                                  href={`/app/evenements/types?type=${type.id}`}
                                  className="truncate text-[15px] font-semibold text-ink after:absolute after:inset-0"
                                >
                                  {type.name}
                                </Link>
                              </div>
                            </td>
                            <td className="px-3 text-[13px] text-ink-soft">
                              {formatDuration(type.defaultDurationMinutes)}
                            </td>
                            <td className="px-3 text-[13px] text-ink-soft">
                              {type.defaultPriceCents
                                ? formatMoney(type.defaultPriceCents)
                                : "Gratuit"}
                            </td>
                            <td
                              className={cn(
                                "px-3 pr-5 text-right text-sm font-semibold",
                                type.eventCount === 0 ? "text-ink-faint" : "text-ink",
                              )}
                            >
                              {type.eventCount}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </div>
        {panelValues && (
          <aside
            className={cn(
              cardShellClasses,
              "overflow-hidden lg:sticky lg:top-4 lg:w-[460px] lg:shrink-0",
            )}
          >
            <EventTypeForm key={panelValues.id ?? "nouveau"} initial={panelValues} />
          </aside>
        )}
      </div>
      {!panelValues && types.length > 0 && (
        <FabLink href="/app/evenements/types?type=nouveau">Nouveau</FabLink>
      )}
    </div>
  );
}
