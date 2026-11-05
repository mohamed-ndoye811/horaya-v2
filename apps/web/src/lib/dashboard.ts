import { addDays } from "@horaya/core";
import { type CivilDate, civilKey } from "./calendar";

/** Variation en % d'une période à l'autre ; null quand il n'y a rien à comparer. */
export function percentChange(current: number, previous: number): number | null {
  if (previous <= 0) return null;
  return Math.round(((current - previous) / previous) * 100);
}

/** Valeurs jour par jour, du premier au dernier jour inclus (0 les jours sans rien). */
export function dailySeries(
  byDay: Record<string, number>,
  from: CivilDate,
  to: CivilDate,
): number[] {
  const values: number[] = [];
  for (let day = from; civilKey(day) <= civilKey(to); day = addDays(day, 1)) {
    values.push(byDay[civilKey(day)] ?? 0);
  }
  return values;
}

/** Durée écoulée courte : « 12 min », « 2 h », « 3 j ». */
export function elapsed(since: Date, now: Date): string {
  const minutes = Math.max(0, Math.floor((now.getTime() - since.getTime()) / 60_000));
  if (minutes < 60) return `${Math.max(1, minutes)} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} h`;
  return `${Math.floor(hours / 24)} j`;
}

/** « Camille », « Camille et Léa », « Camille, Léa et Antoine ». */
export function joinNames(names: string[]): string {
  if (names.length <= 1) return names[0] ?? "";
  return `${names.slice(0, -1).join(", ")} et ${names[names.length - 1]}`;
}
