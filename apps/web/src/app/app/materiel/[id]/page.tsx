import { addDays } from "@horaya/core";
import { getItemDetail, type ItemAllocationRow } from "@horaya/db";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  AvailabilityGrid,
  allocationLabel,
  RENTAL_COLOR,
} from "@/components/app/availability-grid";
import { PageHeader } from "@/components/app/page-header";
import { StatusBadge, type Tone } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { BoxIcon, ChevronLeft, ChevronRight, PlusIcon } from "@/components/ui/icons";
import { cardClasses, cardShellClasses } from "@/components/ui/section";
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
        titleAside={
          <StatusBadge tone={badgeTone}>
            {available} sur {item.units} disponible{available > 1 ? "s" : ""}
          </StatusBadge>
        }
        subtitle={
          <>
            {[item.typeName, `${item.units} exemplaire${item.units > 1 ? "s" : ""}`]
              .filter(Boolean)
              .join(" · ")}
            .{" "}
            <span className="text-ink">
              {outings} sortie{outings > 1 ? "s" : ""} depuis l'achat.
            </span>
          </>
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

      <div className="grid items-start gap-4 px-4 pb-4 lg:grid-cols-[340px_minmax(0,1fr)]">
        <aside className="flex flex-col gap-4">
          <section className={cn(cardShellClasses, "gap-2 p-2")}>
            <div
              aria-hidden="true"
              className="flex aspect-[324/220] items-center justify-center rounded-[18px] bg-field text-ink-subtle"
            >
              <BoxIcon size={56} />
            </div>
            <p className="px-2 pb-1 text-xs leading-4 text-ink-subtle">Photos · à venir</p>
          </section>
          <section className={cn(cardShellClasses, "px-5 py-2")}>
            <dl className="flex flex-col">
              {facts.map(([label, value, money], index) => (
                <div
                  key={label}
                  className={cn(
                    "flex min-h-10 items-center justify-between gap-4 py-2",
                    index > 0 && "border-t border-[#f4f4f2]",
                  )}
                >
                  <dt className="text-[13px] leading-[17px] text-ink-subtle">{label}</dt>
                  <dd
                    className={cn(
                      "text-right text-sm font-semibold leading-[18px]",
                      money ? "text-success" : value === "—" ? "text-[#ababa6]" : "text-ink",
                    )}
                  >
                    {value}
                  </dd>
                </div>
              ))}
            </dl>
            {item.description && (
              <p className="whitespace-pre-line border-t border-[#f4f4f2] py-3 text-[13px] leading-5 text-ink-muted">
                {item.description}
              </p>
            )}
          </section>
        </aside>

        <div className="flex min-w-0 flex-col gap-4">
          <section className={cn(cardClasses, "gap-3.5")}>
            <div className="flex items-center justify-between gap-4">
              <h2 className="text-base font-semibold leading-5 text-ink">Disponibilité</h2>
              <div className="flex items-center gap-2">
                <Link
                  href={navHref(-DAYS)}
                  aria-label="Quinzaine précédente"
                  className="flex size-[30px] items-center justify-center rounded-full border border-[#e2e2df] text-ink hover:bg-field"
                >
                  <ChevronLeft />
                </Link>
                <span className="text-sm font-semibold leading-[18px] text-ink">
                  {rangeLabel(first, last)}
                </span>
                <Link
                  href={navHref(DAYS)}
                  aria-label="Quinzaine suivante"
                  className="flex size-[30px] items-center justify-center rounded-full border border-[#e2e2df] text-ink hover:bg-field"
                >
                  <ChevronRight />
                </Link>
              </div>
            </div>
            {activeUnits.length === 0 ? (
              <p className="rounded-2xl border-[1.5px] border-dashed border-[#e2e2df] px-5 py-8 text-center text-sm text-ink-subtle">
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
              <ul className="flex flex-wrap gap-x-[18px] gap-y-2 border-t border-[#f0f0ee] pt-3.5">
                {[...legend.values()].map((allocation) => (
                  <li
                    key={allocation.id}
                    className="flex items-center gap-1.5 text-xs leading-4 text-[#4a4a4a]"
                  >
                    <span
                      aria-hidden="true"
                      className={cn(
                        "size-2 shrink-0 rounded-[3px]",
                        allocation.kind === "maintenance" &&
                          "border-[1.5px] border-dashed border-[#d9a441]",
                      )}
                      style={
                        allocation.kind === "maintenance"
                          ? undefined
                          : {
                              backgroundColor:
                                allocation.kind === "rental"
                                  ? RENTAL_COLOR
                                  : (allocation.eventColor ?? RENTAL_COLOR),
                            }
                      }
                    />
                    {allocationLabel(allocation)}
                    <span className="text-ink-subtle">{dayRange(allocation, timeZone)}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="border-t border-[#f0f0ee] pt-3.5 text-[13px] text-ink-subtle">
                Aucune sortie sur ces deux semaines : tous les exemplaires sont libres.
              </p>
            )}
          </section>

          <section id="maintenance" className={cn(cardShellClasses, "px-5 pt-4 pb-2")}>
            <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-2 pb-2.5">
              <h2 className="text-base font-semibold leading-5 text-ink">
                Historique de maintenance
              </h2>
              {activeUnits.length > 0 && (
                <AddMaintenance itemId={id} units={activeUnits} today={civilKey(today)} />
              )}
            </div>
            {interventions.length === 0 ? (
              <p className="border-t border-[#f4f4f2] py-4 text-[13px] text-ink-subtle">
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
                        "flex min-h-14 flex-wrap items-center gap-x-3.5 gap-y-1 border-t border-[#f4f4f2] py-2",
                        intervention.cancelled && "opacity-60",
                      )}
                    >
                      <span className="w-[72px] shrink-0 text-[13px] font-semibold leading-[17px] text-ink">
                        {civil(start, start.year !== today.year)}
                      </span>
                      <div className="flex min-w-0 flex-1 flex-col gap-px">
                        <p className="text-sm font-semibold leading-[18px] text-ink">
                          {intervention.title} · {unitsLabel}
                        </p>
                        <p className="text-xs leading-4 text-ink-subtle">
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
                      <div className="flex items-center gap-4">
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
