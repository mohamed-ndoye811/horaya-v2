import { listEventTypes } from "@horaya/db";
import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/app/page-header";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { PlusIcon } from "@/components/ui/icons";
import { cn } from "@/lib/cn";
import { formatMoney } from "@/lib/format";
import { param } from "@/lib/search-params";
import { db } from "@/server/db";
import { getWorkspaceContext } from "@/server/workspace";
import { EventTypeForm, type EventTypeFormValues, TYPE_COLORS } from "./event-type-form";

export const metadata: Metadata = { title: "Types d'événements · Horaya" };

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
export default async function EventTypesPage({ searchParams }: PageProps<"/app/evenements/types">) {
  const { workspace } = await getWorkspaceContext();
  const selected = param((await searchParams).type);
  const types = await listEventTypes(db, workspace.id);
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
    <div className="flex min-h-dvh flex-col">
      <PageHeader
        eyebrow="Événements / Types"
        title="Types d'événements"
        subtitle="Un type définit la couleur, les réglages par défaut et les infos demandées à la réservation."
        actions={
          <ButtonLink href="/app/evenements/types?type=nouveau" icon={<PlusIcon />}>
            Nouveau type
          </ButtonLink>
        }
      />
      <div className="flex flex-1 flex-col lg:flex-row">
        <div className="min-w-0 flex-1">
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
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] table-fixed border-collapse">
                <colgroup>
                  <col />
                  <col style={{ width: 120 }} />
                  <col style={{ width: 110 }} />
                  <col style={{ width: 130 }} />
                </colgroup>
                <thead>
                  <tr className="border-b-2 border-ink">
                    {["Type", "Durée", "Prix", "Événements"].map((label, index) => (
                      <th
                        key={label}
                        scope="col"
                        className={cn(
                          "px-3 py-4 font-mono text-label font-semibold uppercase tracking-[0.055em] text-ink first:pl-4 last:pr-4 sm:first:pl-10 sm:last:pr-8",
                          index >= 2 ? "text-right" : "text-left",
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
                          "border-b border-line-soft",
                          active && "bg-surface shadow-[inset_4px_0_0_var(--color-ink)]",
                        )}
                      >
                        <td className="px-3 py-4 pl-4 sm:pl-10">
                          <div className="flex items-center gap-3.5">
                            <span
                              className="size-7 shrink-0"
                              style={{ backgroundColor: type.color }}
                              aria-hidden="true"
                            />
                            <div className="flex min-w-0 flex-col gap-1">
                              <Link
                                href={`/app/evenements/types?type=${type.id}`}
                                className="truncate text-base font-bold text-ink hover:underline"
                              >
                                {type.name}
                              </Link>
                              <span className="truncate text-sm font-medium text-ink-muted">
                                {summary(type)}
                              </span>
                            </div>
                          </div>
                        </td>
                        <td className="px-3 font-mono text-sm font-semibold text-ink">
                          {formatDuration(type.defaultDurationMinutes)}
                        </td>
                        <td className="px-3 text-right text-[15px] font-extrabold text-ink">
                          {type.defaultPriceCents ? formatMoney(type.defaultPriceCents) : "Gratuit"}
                        </td>
                        <td className="px-3 pr-4 text-right font-mono text-sm font-semibold text-ink sm:pr-8">
                          {type.eventCount}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
        {panelValues && (
          <aside className="border-t-2 border-ink bg-surface lg:sticky lg:top-0 lg:h-dvh lg:w-[440px] lg:shrink-0 lg:border-t-0 lg:border-l-2">
            <EventTypeForm key={panelValues.id ?? "nouveau"} initial={panelValues} />
          </aside>
        )}
      </div>
    </div>
  );
}
