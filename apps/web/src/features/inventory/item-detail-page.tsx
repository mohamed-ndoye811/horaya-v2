import { addDays } from "@horaya/core";
import type { ItemAllocationRow } from "@horaya/db";
import {
  AvailabilityGrid,
  allocationLabel,
  RENTAL_COLOR,
} from "@/components/app/availability-grid";
import { useImageUpload } from "@/components/app/image-upload";
import { PageHeader } from "@/components/app/page-header";
import { StatusBadge, type Tone } from "@/components/ui/badge";
import { Button, ButtonLink, IconLink } from "@/components/ui/button";
import { FieldError } from "@/components/ui/field";
import { BoxIcon, ChevronLeft, ChevronRight, PlusIcon } from "@/components/ui/icons";
import { cardClasses, cardShellClasses, dashedClasses } from "@/components/ui/section";
import type { getItem } from "@/functions/inventory";
import { type CivilDate, civilDateOf, civilKey, daysCovered } from "@/lib/calendar";
import { cn } from "@/lib/cn";
import { parseCivilDate } from "@/lib/dates";
import { formatMoney } from "@/lib/format";
import { withParams } from "@/lib/search-params";
import { AddMaintenance, CancelMaintenance } from "./maintenance";

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
export function ItemDetailPage({ data }: { data: Awaited<ReturnType<typeof getItem>> }) {
  const { timeZone, today, first, detail } = data;
  const id = detail.item.id;
  const now = new Date();
  const days = Array.from({ length: DAYS }, (_, offset) => addDays(first, offset));
  const last = days.at(-1) ?? first;
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
          <ItemPhoto id={item.id} photoUrl={item.photoUrl} />
          <section className={cn(cardShellClasses, "px-5 py-2")}>
            <dl className="flex flex-col">
              {facts.map(([label, value, money], index) => (
                <div
                  key={label}
                  className={cn(
                    "flex min-h-10 items-center justify-between gap-4 py-2",
                    index > 0 && "border-t border-line-faint",
                  )}
                >
                  <dt className="text-[13px] leading-[17px] text-ink-subtle">{label}</dt>
                  <dd
                    className={cn(
                      "text-right text-sm font-semibold leading-[18px]",
                      money ? "text-success" : value === "—" ? "text-ink-faint" : "text-ink",
                    )}
                  >
                    {value}
                  </dd>
                </div>
              ))}
            </dl>
            {item.description && (
              <p className="whitespace-pre-line border-t border-line-faint py-3 text-[13px] leading-5 text-ink-muted">
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
                <IconLink href={navHref(-DAYS)} label="Quinzaine précédente">
                  <ChevronLeft />
                </IconLink>
                <span className="text-sm font-semibold leading-[18px] text-ink">
                  {rangeLabel(first, last)}
                </span>
                <IconLink href={navHref(DAYS)} label="Quinzaine suivante">
                  <ChevronRight />
                </IconLink>
              </div>
            </div>
            {activeUnits.length === 0 ? (
              <p
                className={cn(
                  dashedClasses,
                  "rounded-2xl px-5 py-8 text-center text-sm text-ink-subtle",
                )}
              >
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
              <ul className="flex flex-wrap gap-x-[18px] gap-y-2 border-t border-line-faint pt-3.5">
                {[...legend.values()].map((allocation) => (
                  <li
                    key={allocation.id}
                    className="flex items-center gap-1.5 text-xs leading-4 text-ink-soft"
                  >
                    <span
                      aria-hidden="true"
                      className={cn(
                        "size-2 shrink-0 rounded-[3px]",
                        allocation.kind === "maintenance" &&
                          "border-[1.5px] border-dashed border-warning-line",
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
              <p className="border-t border-line-faint pt-3.5 text-[13px] text-ink-subtle">
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
              <p className="border-t border-line-faint py-4 text-[13px] text-ink-subtle">
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
                        "flex min-h-14 flex-wrap items-center gap-x-3.5 gap-y-1 border-t border-line-faint py-2",
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

/** Photo de l'article : ajout, remplacement, retrait (réduite avant l'envoi). */
function ItemPhoto({ id, photoUrl }: { id: string; photoUrl: string | null }) {
  const { pick, remove, pending, error, fileInput } = useImageUpload("article", id);
  return (
    <section className={cn(cardShellClasses, "gap-2 p-2")}>
      <div className="relative flex aspect-[324/220] items-center justify-center overflow-hidden rounded-[18px] bg-field text-ink-subtle">
        {photoUrl ? (
          <img src={photoUrl} alt="" className="absolute inset-0 size-full object-cover" />
        ) : (
          <BoxIcon size={56} />
        )}
      </div>
      <div className="flex flex-wrap items-center gap-2 px-1 pb-1">
        <Button variant="secondary" size="xs" pending={pending} onClick={pick}>
          {photoUrl ? "Changer la photo" : "Ajouter une photo"}
        </Button>
        {photoUrl && (
          <Button variant="secondary" size="xs" disabled={pending} onClick={remove}>
            Retirer
          </Button>
        )}
      </div>
      {error && (
        <div className="px-2 pb-1">
          <FieldError>{error}</FieldError>
        </div>
      )}
      {fileInput}
    </section>
  );
}
