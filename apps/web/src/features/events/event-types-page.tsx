import type { EventModules } from "@horaya/core";
import { FabLink } from "@/components/app/fab";
import { PageHeader } from "@/components/app/page-header";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { ChevronRight, PlusIcon } from "@/components/ui/icons";
import { cardShellClasses } from "@/components/ui/section";
import type { getEventTypes } from "@/functions/events";
import { cn } from "@/lib/cn";
import { formatMoney } from "@/lib/format";
import { Link, useRouter } from "@/lib/navigation";
import { TemplateDialog } from "./template-dialog";

function formatDuration(minutes: number | null): string {
  if (!minutes) return "—";
  if (minutes % 1440 === 0) return `${minutes / 1440} jour${minutes > 1440 ? "s" : ""}`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (hours === 0) return `${rest} min`;
  return rest ? `${hours} h ${rest}` : `${hours} h`;
}

function summary(type: { fields: Array<{ scope: string }>; modules: EventModules }): string {
  const described = type.fields.filter((field) => field.scope === "event").length;
  const asked = type.fields.length - described;
  const modules = Object.keys(type.modules).length;
  return [
    type.modules.approval ? "Validation manuelle" : "Réservation automatique",
    modules > 0 ? `${modules} module${modules > 1 ? "s" : ""}` : null,
    described > 0 ? `${described} info${described > 1 ? "s" : ""}` : null,
    asked > 0 ? `${asked} question${asked > 1 ? "s" : ""}` : null,
  ]
    .filter(Boolean)
    .join(" · ");
}

/** Écran 16 : types d'événements (chaque type s'ouvre dans l'éditeur, maquette 9.1). */
export function EventTypesPage({
  data,
  choosing,
}: {
  data: Awaited<ReturnType<typeof getEventTypes>>;
  /** « Nouveau type » : choix d'un modèle (maquette 9.3). */
  choosing: boolean;
}) {
  const { types } = data;
  const router = useRouter();

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
        <div className="min-w-0 flex-1">
          {types.length === 0 ? (
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
              <ul
                aria-label="Types d'événements"
                className="reveal-group flex flex-col overflow-hidden rounded-3xl bg-surface lg:hidden"
              >
                {types.map((type) => (
                  <li key={type.id} className="border-b border-line-soft">
                    <Link
                      href={`/app/evenements/types?type=${type.id}`}
                      className="press flex items-center gap-3.5 px-4 py-4 text-ink hover:bg-band"
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
              <div className="hidden lg:block">
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
                    <tbody className="reveal-group [--reveal:var(--animate-fade)]">
                      {types.map((type) => {
                        return (
                          <tr
                            key={type.id}
                            className="relative h-[60px] border-t border-line-faint transition-colors hover:bg-band"
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
      </div>
      {choosing && (
        <TemplateDialog types={types} onClose={() => router.push("/app/evenements/types")} />
      )}
      {types.length > 0 && <FabLink href="/app/evenements/types?type=nouveau">Nouveau</FabLink>}
    </div>
  );
}
