import { addDays, fromZonedParts, toZonedParts, weekdayOf } from "@horaya/core";
import { type CivilDate, civilKey } from "./calendar";

/** « 2026-06-15 » → date civile ; null si invalide. */
export function parseCivilDate(value: string | undefined | null): CivilDate | null {
  const match = value?.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;
  const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])];
  const check = new Date(Date.UTC(year, month - 1, day));
  if (check.getUTCMonth() !== month - 1) return null;
  return { year, month, day };
}

export function todayIn(timeZone: string, now = new Date()): CivilDate {
  const { year, month, day } = toZonedParts(now, timeZone);
  return { year, month, day };
}

/** Minuit (heure de l'espace) d'une date civile, en instant UTC. */
export function startOfDay(date: CivilDate, timeZone: string): Date {
  return fromZonedParts({ ...date, hour: 0, minute: 0 }, timeZone);
}

export function mondayOf(date: CivilDate): CivilDate {
  return addDays(date, -weekdayOf(date.year, date.month, date.day));
}

export function addMonths(date: CivilDate, months: number): CivilDate {
  const index = date.year * 12 + (date.month - 1) + months;
  return { year: Math.floor(index / 12), month: (index % 12) + 1, day: 1 };
}

/** Numéro de semaine ISO 8601. */
export function isoWeek(date: CivilDate): number {
  const thursday = addDays(date, 3 - weekdayOf(date.year, date.month, date.day));
  const firstThursday = addDays(
    { year: thursday.year, month: 1, day: 4 },
    -weekdayOf(thursday.year, 1, 4) + 3,
  );
  const days =
    (Date.UTC(thursday.year, thursday.month - 1, thursday.day) -
      Date.UTC(firstThursday.year, firstThursday.month - 1, firstThursday.day)) /
    86_400_000;
  return Math.round(days / 7) + 1;
}

export { civilKey };
