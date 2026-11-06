/**
 * Géométrie des calendriers (mois, semaine, jour). Fonctions pures, testées à part.
 * Les dates « civiles » sont des chaînes AAAA-MM-JJ dans le fuseau de l'espace.
 */
import { addDays, fromZonedParts, toZonedParts, weekdayOf } from "@horaya/core";

export interface CivilDate {
  year: number;
  month: number;
  day: number;
}

export const civilKey = ({ year, month, day }: CivilDate) =>
  `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;

export function civilDateOf(date: Date, timeZone: string): CivilDate {
  const { year, month, day } = toZonedParts(date, timeZone);
  return { year, month, day };
}

/** Lundi de la semaine d'une date civile. */
export function startOfWeek(date: CivilDate): CivilDate {
  return addDays(date, -weekdayOf(date.year, date.month, date.day));
}

/**
 * Grille du mois : semaines complètes du lundi au dimanche, de la semaine du 1er
 * à celle du dernier jour (5 ou 6 lignes).
 */
export function monthGrid(
  year: number,
  month: number,
): Array<Array<CivilDate & { inMonth: boolean }>> {
  const first = startOfWeek({ year, month, day: 1 });
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const last = { year, month, day: lastDay };
  const weeks: Array<Array<CivilDate & { inMonth: boolean }>> = [];
  let cursor = first;
  while (
    weeks.length === 0 ||
    Date.UTC(cursor.year, cursor.month - 1, cursor.day) <=
      Date.UTC(last.year, last.month - 1, last.day)
  ) {
    const week = Array.from({ length: 7 }, (_, offset) => {
      const date = addDays(cursor, offset);
      return { ...date, inMonth: date.month === month };
    });
    weeks.push(week);
    cursor = addDays(cursor, 7);
  }
  return weeks;
}

export interface TimedItem {
  id: string;
  startsAt: Date;
  endsAt: Date;
}

export interface PlacedItem<T extends TimedItem> {
  item: T;
  /** Position verticale en minutes depuis le début de la plage affichée. */
  top: number;
  height: number;
  /** Colonne occupée parmi les événements qui se chevauchent. */
  column: number;
  columns: number;
}

/**
 * Place les événements d'une journée dans la grille horaire : les événements qui se
 * chevauchent se partagent la largeur en colonnes, comme dans un agenda classique.
 */
export function layoutDay<T extends TimedItem>(
  items: T[],
  day: CivilDate,
  timeZone: string,
  range: { startHour: number; endHour: number },
): Array<PlacedItem<T>> {
  const dayStart = fromZonedParts({ ...day, hour: range.startHour, minute: 0 }, timeZone).getTime();
  const dayEnd = fromZonedParts({ ...day, hour: range.endHour, minute: 0 }, timeZone).getTime();

  const visible = items
    .filter((item) => item.startsAt.getTime() < dayEnd && item.endsAt.getTime() > dayStart)
    .sort(
      (a, b) =>
        a.startsAt.getTime() - b.startsAt.getTime() || b.endsAt.getTime() - a.endsAt.getTime(),
    );

  const placed: Array<PlacedItem<T>> = [];
  let cluster: Array<PlacedItem<T>> = [];
  let clusterEnd = -Infinity;
  const columnEnds: number[] = [];

  const closeCluster = () => {
    const columns = Math.max(1, ...cluster.map((entry) => entry.column + 1));
    for (const entry of cluster) entry.columns = columns;
    cluster = [];
    columnEnds.length = 0;
  };

  for (const item of visible) {
    const start = Math.max(item.startsAt.getTime(), dayStart);
    const end = Math.min(item.endsAt.getTime(), dayEnd);
    if (start >= clusterEnd) closeCluster();

    let column = columnEnds.findIndex((columnEnd) => columnEnd <= start);
    if (column === -1) column = columnEnds.length;
    columnEnds[column] = end;
    clusterEnd = Math.max(clusterEnd, end);

    const entry: PlacedItem<T> = {
      item,
      top: (start - dayStart) / 60_000,
      height: Math.max(15, (end - start) / 60_000),
      column,
      columns: 1,
    };
    cluster.push(entry);
    placed.push(entry);
  }
  closeCluster();
  return placed;
}

/** Un événement qui couvre plusieurs jours (ou une journée entière) va dans la ligne « Jour ». */
export function isAllDay(item: TimedItem, timeZone: string): boolean {
  const start = civilDateOf(item.startsAt, timeZone);
  const end = civilDateOf(new Date(item.endsAt.getTime() - 1), timeZone);
  return (
    civilKey(start) !== civilKey(end) ||
    item.endsAt.getTime() - item.startsAt.getTime() >= 20 * 3_600_000
  );
}

function dayIndex(date: CivilDate): number {
  return Date.UTC(date.year, date.month - 1, date.day) / 86_400_000;
}

/** Jours civils couverts par un événement (fin exclusive : un événement finissant à minuit ne déborde pas). */
export function daysCovered(item: TimedItem, timeZone: string): CivilDate[] {
  const first = civilDateOf(item.startsAt, timeZone);
  const last = civilDateOf(
    new Date(Math.max(item.startsAt.getTime(), item.endsAt.getTime() - 1)),
    timeZone,
  );
  const count = dayIndex(last) - dayIndex(first) + 1;
  return Array.from({ length: Math.min(count, 366) }, (_, offset) => addDays(first, offset));
}

/** Regroupe les événements par jour (clé AAAA-MM-JJ), triés par heure de début. */
export function groupByDay<T extends TimedItem>(items: T[], timeZone: string): Map<string, T[]> {
  const days = new Map<string, T[]>();
  const sorted = [...items].sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime());
  for (const item of sorted) {
    for (const day of daysCovered(item, timeZone)) {
      const key = civilKey(day);
      days.set(key, [...(days.get(key) ?? []), item]);
    }
  }
  return days;
}

export interface SpanItem<T> {
  item: T;
  /** Première et dernière colonne (0 = premier jour affiché). */
  startColumn: number;
  endColumn: number;
  lane: number;
  /** L'événement commence avant / finit après la période affichée. */
  continuesBefore: boolean;
  continuesAfter: boolean;
}

/** Barres de la ligne « Jour » : chaque événement occupe ses colonnes, sur la première ligne libre. */
export function layoutSpans<T extends TimedItem>(
  items: T[],
  days: CivilDate[],
  timeZone: string,
): Array<SpanItem<T>> {
  const firstDay = days[0];
  const lastDay = days.at(-1);
  if (!firstDay || !lastDay) return [];
  const from = dayIndex(firstDay);
  const to = dayIndex(lastDay);
  const laneEnds: number[] = [];
  const spans: Array<SpanItem<T>> = [];

  const sorted = [...items].sort(
    (a, b) =>
      a.startsAt.getTime() - b.startsAt.getTime() || b.endsAt.getTime() - a.endsAt.getTime(),
  );
  for (const item of sorted) {
    const covered = daysCovered(item, timeZone).map(dayIndex);
    const start = covered[0] ?? from;
    const end = covered.at(-1) ?? start;
    if (end < from || start > to) continue;
    const startColumn = Math.max(start, from) - from;
    const endColumn = Math.min(end, to) - from;
    let lane = laneEnds.findIndex((laneEnd) => laneEnd < startColumn);
    if (lane === -1) lane = laneEnds.length;
    laneEnds[lane] = endColumn;
    spans.push({
      item,
      startColumn,
      endColumn,
      lane,
      continuesBefore: start < from,
      continuesAfter: end > to,
    });
  }
  return spans;
}
