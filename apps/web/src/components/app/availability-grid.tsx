import { weekdayOf } from "@horaya/core";
import type { ItemAllocationRow } from "@horaya/db";
import { type CivilDate, civilKey, layoutSpans } from "@/lib/calendar";
import { cn } from "@/lib/cn";
import { textOn } from "@/lib/colors";
import { Link } from "@/lib/navigation";

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
 * Au-delà de `visibleRows` exemplaires (150 chaises), les suivants se déplient à la demande.
 */
export function AvailabilityGrid({
  days,
  today,
  units,
  allocations,
  timeZone,
  visibleRows = 12,
}: {
  days: CivilDate[];
  today: CivilDate;
  units: Array<{ id: string; label: string; status: string }>;
  allocations: ItemAllocationRow[];
  timeZone: string;
  visibleRows?: number;
}) {
  const todayKey = civilKey(today);
  const columns = `64px repeat(${days.length}, minmax(44px, 1fr))`;
  const isWeekend = (day: CivilDate) => weekdayOf(day.year, day.month, day.day) >= 5;
  const row = (unit: (typeof units)[number]) => {
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
        className="grid border-b border-line-faint last:border-b-0"
        style={{
          gridTemplateColumns: columns,
          gridTemplateRows: `repeat(${lanes}, minmax(0, 1fr))`,
          height: 40 + (lanes - 1) * 28,
        }}
      >
        <span
          style={{ gridColumn: 1, gridRow: "1 / -1" }}
          // Collée à gauche : sur mobile, la grille défile sous le nom de l'exemplaire.
          className={cn(
            "sticky left-0 z-20 flex items-center bg-surface text-xs font-semibold leading-4",
            unit.status === "available" ? "text-ink-subtle" : "text-ink-faint line-through",
          )}
        >
          Ex. {unit.label}
        </span>
        {days.map((day, index) => (
          <span
            key={civilKey(day)}
            aria-hidden="true"
            className={cn(
              civilKey(day) === todayKey && "border-l-2 border-ink/15",
              isWeekend(day) && "bg-band",
            )}
            style={{ gridColumn: index + 2, gridRow: "1 / -1" }}
          />
        ))}
        {spans.map(({ item: allocation, startColumn, endColumn, lane }) => {
          const label = allocationLabel(allocation);
          const href = allocationHref(allocation);
          const maintenance = allocation.kind === "maintenance";
          const color =
            allocation.kind === "rental" ? RENTAL_COLOR : (allocation.eventColor ?? RENTAL_COLOR);
          const className = cn(
            "z-10 mx-0.5 flex min-w-0 items-center overflow-hidden rounded-lg px-2 text-[11px] font-bold leading-[14px]",
            lanes === 1
              ? "my-[7px]"
              : lane === 0
                ? "mt-1.5 mb-0.5"
                : lane === lanes - 1
                  ? "mt-0.5 mb-1.5"
                  : "my-0.5",
            maintenance &&
              "border-[1.5px] border-dashed border-warning-line bg-warning-bg text-warning",
            href && "hover:brightness-95",
          );
          const style = {
            gridColumn: `${startColumn + 2} / ${endColumn + 3}`,
            gridRow: lane + 1,
            ...(maintenance ? {} : { backgroundColor: color, color: textOn(color) }),
          };
          return href ? (
            <Link key={allocation.id} href={href} title={label} className={className} style={style}>
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
  };

  return (
    <div className="overflow-x-auto">
      <figure aria-label="Disponibilité par exemplaire" className="m-0 min-w-[720px]">
        <div className="grid pb-3.5" style={{ gridTemplateColumns: columns }}>
          <span aria-hidden="true" className="sticky left-0 z-20 bg-surface" />
          {days.map((day) => {
            const isToday = civilKey(day) === todayKey;
            return (
              <span
                key={civilKey(day)}
                aria-current={isToday ? "date" : undefined}
                className="flex justify-center"
              >
                <span
                  className={cn(
                    "flex size-11 flex-col items-center justify-center rounded-xl",
                    isToday && "bg-ink",
                  )}
                >
                  <span
                    className={cn(
                      "text-[10px] font-bold leading-3",
                      isToday
                        ? "text-on-ink/60"
                        : isWeekend(day)
                          ? "text-ink-faint"
                          : "text-ink-subtle",
                    )}
                  >
                    {DAY_LETTERS[weekdayOf(day.year, day.month, day.day)]}
                  </span>
                  <span
                    className={cn(
                      "text-ui font-semibold leading-[18px]",
                      isToday ? "text-on-ink" : isWeekend(day) ? "text-ink-faint" : "text-ink",
                    )}
                  >
                    {day.day}
                  </span>
                </span>
              </span>
            );
          })}
        </div>
        {units.slice(0, visibleRows).map(row)}
        {units.length > visibleRows && (
          <details className="group border-t border-line-faint">
            <summary className="flex list-none items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-meta font-semibold text-ink hover:bg-field [&::-webkit-details-marker]:hidden">
              <span className="group-open:hidden">
                Afficher les {units.length - visibleRows} autres exemplaires
              </span>
              <span className="hidden group-open:inline">Masquer les autres exemplaires</span>
            </summary>
            {units.slice(visibleRows).map(row)}
          </details>
        )}
      </figure>
    </div>
  );
}
