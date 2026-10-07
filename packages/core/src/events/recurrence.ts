import { z } from "zod";
import { ValidationError } from "../shared/errors";
import { addDays, daysInMonth, fromZonedParts, toZonedParts, weekdayOf } from "../shared/time";

/** Plafond d'occurrences créées d'un coup (deux ans d'hebdomadaire). */
export const MAX_OCCURRENCES = 104;

export const RECURRENCE_FREQUENCIES = ["daily", "weekly", "monthly"] as const;
const RRULE_DAYS = ["MO", "TU", "WE", "TH", "FR", "SA", "SU"] as const;

export const recurrenceSchema = z
  .object({
    frequency: z.enum(RECURRENCE_FREQUENCIES),
    interval: z.int().min(1).max(12).default(1),
    /** Hebdomadaire uniquement : jours de la semaine, 0 = lundi. Par défaut, celui du 1er. */
    weekdays: z.array(z.int().min(0).max(6)).min(1).max(7).optional(),
    count: z.int().min(2).max(MAX_OCCURRENCES).optional(),
    until: z.coerce.date().optional(),
  })
  .refine((rule) => (rule.count === undefined) !== (rule.until === undefined), {
    message: "Indique soit un nombre d'occurrences, soit une date de fin",
    path: ["count"],
  });
export type Recurrence = z.infer<typeof recurrenceSchema>;

/**
 * Débuts des occurrences d'une série, en gardant l'heure locale du premier
 * (10 h reste 10 h à Paris après le passage à l'heure d'été).
 * Mensuel : même quantième ; les mois où il n'existe pas (31) sont sautés, comme en iCalendar.
 */
export function generateOccurrences(rule: Recurrence, firstStart: Date, timeZone: string): Date[] {
  const first = toZonedParts(firstStart, timeZone);
  const time = { hour: first.hour, minute: first.minute };
  const limit = rule.count ?? MAX_OCCURRENCES;
  const occurrences: Date[] = [];

  const push = (date: { year: number; month: number; day: number }): boolean => {
    const start = fromZonedParts({ ...date, ...time }, timeZone);
    if (rule.until && start > rule.until) return false;
    occurrences.push(start);
    return occurrences.length < limit;
  };

  // Garde-fou : jamais plus d'itérations que nécessaire pour atteindre la limite.
  const maxSteps = limit * 31 + 31;

  if (rule.frequency === "daily") {
    for (let step = 0; step < maxSteps; step++) {
      if (!push(addDays(first, step * rule.interval))) break;
    }
  } else if (rule.frequency === "weekly") {
    const weekdays = [
      ...new Set(rule.weekdays ?? [weekdayOf(first.year, first.month, first.day)]),
    ].sort();
    const monday = addDays(first, -weekdayOf(first.year, first.month, first.day));
    const firstDay = Date.UTC(first.year, first.month - 1, first.day);
    weeks: for (let week = 0; week < maxSteps; week++) {
      for (const weekday of weekdays) {
        const date = addDays(monday, week * 7 * rule.interval + weekday);
        if (Date.UTC(date.year, date.month - 1, date.day) < firstDay) continue;
        if (!push(date)) break weeks;
      }
    }
  } else {
    for (let step = 0; step < maxSteps; step++) {
      const monthIndex = first.month - 1 + step * rule.interval;
      const year = first.year + Math.floor(monthIndex / 12);
      const month = (monthIndex % 12) + 1;
      if (first.day > daysInMonth(year, month)) continue;
      if (!push({ year, month, day: first.day })) break;
    }
  }

  if (occurrences.length < 2) {
    throw new ValidationError("La série doit compter au moins deux occurrences", [
      { path: "recurrence", message: "Allonge la période ou augmente le nombre d'occurrences" },
    ]);
  }
  return occurrences;
}

/** Règle iCalendar équivalente, conservée sur la série (ex. FREQ=WEEKLY;BYDAY=MO,WE;COUNT=10). */
export function toRRule(rule: Recurrence): string {
  const parts = [`FREQ=${rule.frequency.toUpperCase()}`];
  if (rule.interval > 1) parts.push(`INTERVAL=${rule.interval}`);
  if (rule.frequency === "weekly" && rule.weekdays) {
    parts.push(
      `BYDAY=${[...new Set(rule.weekdays)]
        .sort()
        .map((day) => RRULE_DAYS[day])
        .join(",")}`,
    );
  }
  if (rule.count) parts.push(`COUNT=${rule.count}`);
  if (rule.until)
    parts.push(
      `UNTIL=${rule.until
        .toISOString()
        .replace(/[-:]/g, "")
        .replace(/\.\d{3}/, "")}`,
    );
  return parts.join(";");
}
