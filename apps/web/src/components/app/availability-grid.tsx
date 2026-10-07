import { weekdayOf } from "@horaya/core";
import type { ItemAllocationRow } from "@horaya/db";
import Link from "next/link";
import { type CivilDate, civilKey, layoutSpans } from "@/lib/calendar";
import { cn } from "@/lib/cn";
import { textOn } from "@/lib/colors";

const DAY_LETTERS = ["L", "M", "M", "J", "V", "S", "D"];
/** Couleur des locations (pas de type d'événement) : rose des maquettes. */
export const RENTAL_COLOR = "#CF879C";

export function allocationLabel(allocation: ItemAllocationRow): string {
  if (allocation.kind === "maintenance") return allocation.title ?? "Maintenance";
  if (allocation.kind === "rental")
    return allocation.customerName ? `Location · ${allocation.customerName}` : "Location";
  return allocation.eventTitle ?? allocation.title ?? "Événement";
}

export function allocationHref(allocation: ItemAllocationRow): string | null {
  if (allocation.kind === "event" && allocation.eventId)
    return `/app/evenements/${allocation.eventId}`;
  if (allocation.kind === "rental" && allocation.bookingId)
    return `/app/reservations/${allocation.bookingId}`;
  return null;
}

/**
 * Planning d'un article (écran 21) : une ligne par exemplaire, une colonne par jour.
 * Les sorties sont des barres aux couleurs de l'événement, la maintenance en pointillés ambre.
 */
export function AvailabilityGrid({
  days,
  today,
  units,
  allocations,
  timeZone,
}: {
  days: CivilDate[];
  today: CivilDate;
  units: Array<{ id: string; label: string; status: string }>;
  allocations: ItemAllocationRow[];
  timeZone: string;
}) {
  const todayKey = civilKey(today);
  const columns = `88px repeat(${days.length}, minmax(44px, 1fr))`;
  const isWeekend = (day: CivilDate) => weekdayOf(day.year, day.month, day.day) >= 5;

  return (
    <div className="overflow-x-auto">
      <figure
        aria-label="Disponibilité par exemplaire"
        className="m-0 min-w-[720px] border-2 border-ink bg-surface"
      >
        <div className="grid border-b-2 border-ink" style={{ gridTemplateColumns: columns }}>
          <span aria-hidden="true" />
          {days.map((day) => {
            const isToday = civilKey(day) === todayKey;
            return (
              <span
                key={civilKey(day)}
                aria-current={isToday ? "date" : undefined}
                className={cn(
                  "flex flex-col items-center gap-0.5 border-l border-line-soft py-2",
                  isToday ? "bg-ink text-bg" : isWeekend(day) ? "bg-weekend text-ink" : "text-ink",
                )}
              >
                <span className="font-mono text-[10px] font-semibold leading-3">
                  {DAY_LETTERS[weekdayOf(day.year, day.month, day.day)]}
                </span>
                <span className="text-sm font-bold leading-4">{day.day}</span>
              </span>
            );
          })}
        </div>
        {units.map((unit) => {
          const spans = layoutSpans(
            allocations.filter((allocation) => allocation.unitId === unit.id),
            days,
            timeZone,
          );
          // Plusieurs sorties le même jour (réunion le matin, séminaire l'après-midi) : une voie chacune.
          const lanes = Math.max(1, ...spans.map((span) => span.lane + 1));
          return (
            <div
              key={unit.id}
              className="grid border-b border-line-soft last:border-b-0"
              style={{
                gridTemplateColumns: columns,
                gridTemplateRows: `repeat(${lanes}, minmax(0, 1fr))`,
                height: 56 + (lanes - 1) * 28,
              }}
            >
              <span
                style={{ gridColumn: 1, gridRow: "1 / -1" }}
                className={cn(
                  "flex items-center px-3 font-mono text-label font-semibold uppercase tracking-[0.055em]",
                  unit.status === "available" ? "text-ink" : "text-ink-subtle line-through",
                )}
              >
                Ex. {unit.label}
              </span>
              {days.map((day, index) => (
                <span
                  key={civilKey(day)}
                  aria-hidden="true"
                  className={cn(
                    "border-l border-line-soft",
                    civilKey(day) === todayKey ? "bg-today" : isWeekend(day) ? "bg-weekend" : "",
                  )}
                  style={{ gridColumn: index + 2, gridRow: "1 / -1" }}
                />
              ))}
              {spans.map(({ item: allocation, startColumn, endColumn, lane }) => {
                const label = allocationLabel(allocation);
                const href = allocationHref(allocation);
                const maintenance = allocation.kind === "maintenance";
                const color =
                  allocation.kind === "rental"
                    ? RENTAL_COLOR
                    : (allocation.eventColor ?? RENTAL_COLOR);
                const className = cn(
                  "z-10 mx-1 flex min-w-0 items-center overflow-hidden px-2 text-xs font-semibold",
                  lanes === 1
                    ? "my-2"
                    : lane === 0
                      ? "mt-1.5 mb-0.5"
                      : lane === lanes - 1
                        ? "mt-0.5 mb-1.5"
                        : "my-0.5",
                  maintenance &&
                    "border-[1.5px] border-dashed border-warning bg-warning-bg text-warning",
                  href && "hover:brightness-95",
                );
                const style = {
                  gridColumn: `${startColumn + 2} / ${endColumn + 3}`,
                  gridRow: lane + 1,
                  ...(maintenance ? {} : { backgroundColor: color, color: textOn(color) }),
                };
                return href ? (
                  <Link
                    key={allocation.id}
                    href={href}
                    title={label}
                    className={className}
                    style={style}
                  >
                    <span className="truncate">{label}</span>
                  </Link>
                ) : (
                  <span key={allocation.id} title={label} className={className} style={style}>
                    <span className="truncate">{label}</span>
                  </span>
                );
              })}
            </div>
          );
        })}
      </figure>
    </div>
  );
}
