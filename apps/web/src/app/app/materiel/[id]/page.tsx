import { addDays } from "@horaya/core";
import { getItemDetail, type ItemAllocationRow } from "@horaya/db";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import {
  AvailabilityGrid,
  allocationLabel,
  RENTAL_COLOR,
} from "@/components/app/availability-grid";
import { PageHeader } from "@/components/app/page-header";
import { CategorySwatch } from "@/components/ui/avatar";
import { StatusBadge, type Tone } from "@/components/ui/badge";
import { ButtonLink, IconLink } from "@/components/ui/button";
import { BoxIcon, ChevronLeft, ChevronRight, PlusIcon } from "@/components/ui/icons";
import { type CivilDate, civilDateOf, civilKey, daysCovered } from "@/lib/calendar";
import { cn } from "@/lib/cn";
import { parseCivilDate, startOfDay, todayIn } from "@/lib/dates";
import { formatMoney } from "@/lib/format";
import { param, withParams } from "@/lib/search-params";
import { db } from "@/server/db";
import { getWorkspaceContext } from "@/server/workspace";
import { AddMaintenance, CancelMaintenance } from "./maintenance";

export const metadata: Metadata = { title: "Article · Horaya" };

const DAYS = 14;
const MONTHS = [
  "janv.",
  "févr.",
  "mars",
  "avr.",
  "mai",
  "juin",
  "juil.",
  "août",
  "sept.",
  "oct.",
  "nov.",
  "déc.",
];
const FULL_MONTHS = [
  "janvier",
  "février",
  "mars",
  "avril",
  "mai",
  "juin",
  "juillet",
  "août",
  "septembre",
  "octobre",
  "novembre",
  "décembre",
];

const civil = (day: CivilDate, withYear: boolean) =>
  `${day.day} ${MONTHS[day.month - 1]}${withYear ? ` ${day.year}` : ""}`;

function rangeLabel(first: CivilDate, last: CivilDate): string {
  if (first.month === last.month) return `${first.day} – ${last.day} ${MONTHS[last.month - 1]}`;
  return `${civil(first, false)} – ${civil(last, false)}`;
}

/** Jours couverts dans le mois, façon légende (« 15-16 »). */
function dayRange(allocation: ItemAllocationRow, timeZone: string): string {
  const covered = daysCovered(allocation, timeZone);
  const first = covered[0];
  const last = covered.at(-1);
  if (!first || !last) return "";
  if (civilKey(first) === civilKey(last)) return String(first.day);
  return first.month === last.month
    ? `${first.day}-${last.day}`
    : `${civil(first, false)} – ${civil(last, false)}`;
}

interface Intervention {
  key: string;
  ids: string[];
  title: string;
  units: string[];
  startsAt: Date;
  endsAt: Date;
  provider: string | null;
  costCents: number | null;
  cancelled: boolean;
}

/** Les lignes d'une même intervention (une par exemplaire) sont regroupées. */
function groupInterventions(rows: ItemAllocationRow[]): Intervention[] {
  const groups = new Map<string, Intervention>();
  for (const row of rows) {
    const key = [
      row.title,
      row.startsAt.toISOString(),
      row.endsAt.toISOString(),
      row.cancelledAt ? "x" : "",
    ].join("|");
    const group = groups.get(key);
    if (group) {
      group.ids.push(row.id);
      group.units.push(row.unitLabel);
    } else {
      groups.set(key, {
        key,
        ids: [row.id],
        title: row.title ?? "Intervention",
        units: [row.unitLabel],
        startsAt: row.startsAt,
        endsAt: row.endsAt,
        provider: row.provider,
        costCents: row.costCents,
        cancelled: row.cancelledAt !== null,
      });
    }
  }
  return [...groups.values()];
}

function interventionStatus(intervention: Intervention, now: Date): { label: string; tone: Tone } {
  if (intervention.cancelled) return { label: "Annulée", tone: "draft" };
  if (intervention.endsAt <= now) return { label: "Terminée", tone: "success" };
  if (intervention.startsAt <= now) return { label: "En cours", tone: "warning" };
  return { label: "Planifiée", tone: "warning" };
}

/** Écran 21 : fiche d'un article, avec le planning de ses exemplaires. */
export default async function ItemDetailPage({
  params,
  searchParams,
}: PageProps<"/app/materiel/[id]">) {
  const { id } = await params;
  const { workspace, timeZone } = await getWorkspaceContext();
  const now = new Date();
  const today = todayIn(timeZone, now);
  const first = parseCivilDate(param((await searchParams).du)) ?? today;
  const days = Array.from({ length: DAYS }, (_, offset) => addDays(first, offset));
  const last = days.at(-1) ?? first;

  const detail = await getItemDetail(db, workspace.id, id, {
    from: startOfDay(first, timeZone),
    to: startOfDay(addDays(last, 1), timeZone),
    now,
  });
  if (!detail || detail.item.archivedAt) notFound();
  const { item, units, planning, maintenance, outings, rentalRevenueCents } = detail;
  const activeUnits = units.filter((unit) => unit.status !== "retired");
  const interventions = groupInterventions(maintenance);

  // Légende : une entrée par sortie (un événement, une location ou une intervention).
  const legend = new Map<string, ItemAllocationRow>();
  for (const allocation of planning) {
    const key =
      allocation.eventId ??
      allocation.bookingId ??
      `${allocation.title}|${allocation.startsAt.toISOString()}`;
    if (!legend.has(key)) legend.set(key, allocation);
  }

  const available = item.availableNow;
  const badgeTone: Tone =
    available === 0 ? (item.inMaintenanceNow >= item.units ? "warning" : "info") : "success";
  const navHref = (offset: number) =>
    withParams(`/app/materiel/${id}`, { du: civilKey(addDays(first, offset)) });
  const purchased = item.purchasedOn ? parseCivilDate(item.purchasedOn) : null;

  const facts: Array<[string, string, boolean?]> = [
    ["Quantité", `${item.units} exemplaire${item.units > 1 ? "s" : ""}`],
    ["Tarif", item.dailyRateCents === null ? "—" : `${formatMoney(item.dailyRateCents)} / jour`],
    ["Caution", item.depositCents === null ? "—" : formatMoney(item.depositCents)],
    ["Emplacement", item.storageLocation ?? "—"],
    [
      "Acheté le",
      purchased ? `${purchased.day} ${FULL_MONTHS[purchased.month - 1]} ${purchased.year}` : "—",
    ],
    ...(item.purchasePriceCents !== null
      ? [["Prix d'achat", formatMoney(item.purchasePriceCents)] as [string, string]]
      : []),
    ["Revenus cumulés", formatMoney(rentalRevenueCents), true],
  ];

  return (
    <>
      <PageHeader
        eyebrow={`Matériel / Réf. ${item.reference}`}
        title={item.name}
        subtitle={
          <span className="flex flex-wrap items-center gap-x-3 gap-y-2">
            <StatusBadge tone={badgeTone}>
              {available} sur {item.units} disponible{available > 1 ? "s" : ""}
            </StatusBadge>
            <span>
              {[
                item.typeName,
                `${item.units} exemplaire${item.units > 1 ? "s" : ""}`,
                `${outings} sortie${outings > 1 ? "s" : ""} depuis l'achat`,
              ]
                .filter(Boolean)
                .join(" · ")}
            </span>
          </span>
        }
        actions={
          <>
            <ButtonLink href={`/app/materiel/${id}/modifier`} variant="secondary">
              Modifier
            </ButtonLink>
            <ButtonLink href={`/app/materiel/${id}/louer`} icon={<PlusIcon />}>
              Réserver
            </ButtonLink>
          </>
        }
      />

      <div className="grid gap-10 px-4 py-8 sm:px-10 lg:grid-cols-[340px_minmax(0,1fr)]">
        <aside className="flex flex-col gap-6">
          <div
            className="flex aspect-[17/10] items-center justify-center border-2 border-ink bg-info-bg text-ink"
            aria-hidden="true"
          >
            <BoxIcon size={64} />
          </div>
          <dl className="flex flex-col border-t-2 border-ink">
            {facts.map(([label, value, money]) => (
              <div
                key={label}
                className="flex items-baseline justify-between gap-4 border-b border-line-soft py-3.5"
              >
                <dt className="font-mono text-label font-semibold uppercase tracking-[0.055em] text-neutral">
                  {label}
                </dt>
                <dd
                  className={cn(
                    "text-right text-[15px] font-bold",
                    money ? "text-success" : "text-ink",
                  )}
                >
                  {value}
                </dd>
              </div>
            ))}
          </dl>
          {item.description && (
            <p className="whitespace-pre-line text-sm font-medium leading-6 text-ink-muted">
              {item.description}
            </p>
          )}
        </aside>

        <div className="flex min-w-0 flex-col gap-10">
          <section className="flex flex-col gap-4">
            <div className="flex items-center justify-between gap-4">
              <h2 className="font-section text-section leading-7 text-ink">Disponibilité</h2>
              <div className="flex items-center gap-3">
                <span className="font-mono text-label font-semibold uppercase tracking-[0.055em] text-ink">
                  {rangeLabel(first, last)}
                </span>
                <IconLink href={navHref(-DAYS)} label="Quinzaine précédente">
                  <ChevronLeft />
                </IconLink>
                <IconLink href={navHref(DAYS)} label="Quinzaine suivante">
                  <ChevronRight />
                </IconLink>
              </div>
            </div>
            {activeUnits.length === 0 ? (
              <p className="border-2 border-dashed border-ink-subtle px-5 py-8 text-center text-sm font-medium text-ink-muted">
                Aucun exemplaire en service.
              </p>
            ) : (
              <AvailabilityGrid
                days={days}
                today={today}
                units={activeUnits}
                allocations={planning}
                timeZone={timeZone}
              />
            )}
            {legend.size > 0 ? (
              <ul className="flex flex-wrap gap-x-5 gap-y-2">
                {[...legend.values()].map((allocation) => (
                  <li
                    key={allocation.id}
                    className="flex items-center gap-2 text-[13px] font-semibold text-ink"
                  >
                    {allocation.kind === "maintenance" ? (
                      <span
                        aria-hidden="true"
                        className="size-3 shrink-0 border-[1.5px] border-dashed border-warning bg-warning-bg"
                      />
                    ) : (
                      <CategorySwatch
                        color={
                          allocation.kind === "rental"
                            ? RENTAL_COLOR
                            : (allocation.eventColor ?? RENTAL_COLOR)
                        }
                        size={12}
                      />
                    )}
                    {allocationLabel(allocation)}
                    <span className="font-mono text-label text-ink-muted">
                      {dayRange(allocation, timeZone)}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm font-medium text-ink-muted">
                Aucune sortie sur ces deux semaines : tous les exemplaires sont libres.
              </p>
            )}
          </section>

          <section id="maintenance" className="flex flex-col">
            <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-b-2 border-ink pb-3">
              <h2 className="font-section text-section leading-7 text-ink">
                Historique de maintenance
              </h2>
              {activeUnits.length > 0 && (
                <AddMaintenance itemId={id} units={activeUnits} today={civilKey(today)} />
              )}
            </div>
            {interventions.length === 0 ? (
              <p className="py-6 text-sm font-medium text-ink-muted">
                Aucune intervention pour l'instant.
              </p>
            ) : (
              <ul>
                {interventions.map((intervention) => {
                  const status = interventionStatus(intervention, now);
                  const start = civilDateOf(intervention.startsAt, timeZone);
                  const span = daysCovered(
                    { ...intervention, id: intervention.key },
                    timeZone,
                  ).length;
                  const unitsLabel =
                    intervention.units.length === activeUnits.length && activeUnits.length > 1
                      ? `${intervention.units.length} exemplaires`
                      : intervention.units.length > 1
                        ? `exemplaires ${intervention.units.join(", ")}`
                        : `exemplaire ${intervention.units[0]}`;
                  return (
                    <li
                      key={intervention.key}
                      className={cn(
                        "grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-1.5 border-b border-line-soft py-4 sm:grid-cols-[96px_minmax(0,1fr)_auto]",
                        intervention.cancelled && "opacity-60",
                      )}
                    >
                      <span className="col-span-2 font-mono text-label font-semibold uppercase tracking-[0.055em] text-ink-muted sm:col-span-1">
                        {civil(start, start.year !== today.year)}
                      </span>
                      <div className="flex min-w-0 flex-col gap-1">
                        <p className="text-base font-bold text-ink">
                          {intervention.title} · {unitsLabel}
                        </p>
                        <p className="text-[13px] font-medium text-ink-muted">
                          {[
                            intervention.provider,
                            `${span} jour${span > 1 ? "s" : ""} d'immobilisation`,
                            intervention.costCents !== null
                              ? formatMoney(intervention.costCents)
                              : null,
                          ]
                            .filter(Boolean)
                            .join(" · ")}
                        </p>
                      </div>
                      <div className="flex flex-col-reverse items-end gap-2 sm:flex-row sm:items-center sm:gap-4">
                        {status.label === "Planifiée" && (
                          <CancelMaintenance allocationIds={intervention.ids} />
                        )}
                        <StatusBadge tone={status.tone}>{status.label}</StatusBadge>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        </div>
      </div>
    </>
  );
}
