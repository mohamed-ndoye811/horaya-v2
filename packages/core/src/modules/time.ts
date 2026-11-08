import type { Period } from "../inventory/availability";
import { ValidationError } from "../shared/errors";
import { addDays, fromZonedParts, toZonedParts, weekdayOf } from "../shared/time";
import type { DurationModule, DurationOption, EventModules, SlotsModule } from "./registry";

/**
 * Modules « Le temps » (lot 37) : durée au choix et créneaux. Règles pures, partagées par la
 * page publique, le comptoir, l'aperçu de l'éditeur et les cas d'usage.
 */

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/* ---------- Durée au choix ---------- */

/** « 45 min », « 1 h », « 1 h 30 ». */
export function durationLabel(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (hours === 0) return `${rest} min`;
  return rest === 0 ? `${hours} h` : `${hours} h ${String(rest).padStart(2, "0")}`;
}

/** « 1 h », « Journée · 6 h » : le nom, et la durée quand le nom ne la dit pas. */
export const durationTitle = (option: Pick<DurationOption, "label" | "minutes">) =>
  option.label === durationLabel(option.minutes)
    ? option.label
    : `${option.label} · ${durationLabel(option.minutes)}`;

/** La durée choisie, ou celle par défaut (la première si aucune n'est désignée). */
export function durationOf(module: DurationModule, id?: string | null): DurationOption {
  if (id) {
    const found = module.options.find((option) => option.id === id);
    if (!found) {
      throw new ValidationError("Cette durée n'existe pas", [
        { path: "durationId", message: "Choisis une durée proposée" },
      ]);
    }
    return found;
  }
  return (
    module.options.find((option) => option.id === module.defaultId) ??
    (module.options[0] as DurationOption)
  );
}

/** L'événement (ou le créneau) prend la durée choisie : il ne garde qu'elle. */
export function withChosenDuration(modules: EventModules, option: DurationOption): EventModules {
  return { ...modules, duration: { options: [option], defaultId: option.id } };
}

/** Durée d'un créneau : la durée choisie, sinon celle du type (1 h par défaut). */
export function slotMinutes(
  modules: EventModules,
  defaultDurationMinutes: number | null,
  durationId?: string | null,
): number {
  return modules.duration
    ? durationOf(modules.duration, durationId).minutes
    : (defaultDurationMinutes ?? 60);
}

/* ---------- Créneaux ---------- */

export interface CivilDate {
  year: number;
  month: number;
  day: number;
}

export const civilKey = (date: CivilDate) =>
  `${date.year}-${String(date.month).padStart(2, "0")}-${String(date.day).padStart(2, "0")}`;

export function parseCivil(value: string): CivilDate {
  const [year = 1970, month = 1, day = 1] = value.split("-").map(Number);
  return { year, month, day };
}

/** Le jour civil d'un instant dans un fuseau. */
export function civilDateOf(date: Date, timeZone: string): CivilDate {
  const { year, month, day } = toZonedParts(date, timeZone);
  return { year, month, day };
}

/** Le lundi de la semaine d'un jour civil. */
export const mondayOf = (date: CivilDate) =>
  addDays(date, -weekdayOf(date.year, date.month, date.day));

const at = (date: CivilDate, time: string, timeZone: string) => {
  const [hour = 0, minute = 0] = time.split(":").map(Number);
  return fromZonedParts({ ...date, hour, minute }, timeZone);
};

const overlaps = (a: Period, b: Period) => a.startsAt < b.endsAt && b.startsAt < a.endsAt;

/** Ce qui occupe déjà les créneaux du type : un créneau réservé (événement) ou gardé (provisoire). */
export interface TakenSlot extends Period {
  staffMemberId: string | null;
  /** Événement déjà créé pour ce créneau (null : réservation provisoire d'un nouveau créneau). */
  eventId: string | null;
  seatsHeld: number;
  /** Places du créneau (null : illimitées). */
  capacity: number | null;
}

/** Une façon de prendre un créneau : avec qui, et sur quel événement (nouveau ou à compléter). */
export interface SlotOption {
  staffMemberId: string | null;
  eventId: string | null;
  seatsLeft: number;
}

export interface Slot extends Period {
  options: SlotOption[];
}

export interface SlotInput {
  slots: SlotsModule;
  durationMinutes: number;
  timeZone: string;
  /** Premier jour regardé, et nombre de jours. */
  from: CivilDate;
  days: number;
  now: Date;
  /** Créneaux du type déjà réservés ou gardés. */
  taken: readonly TakenSlot[];
  /** Ce qui occupe chaque intervenant proposé ailleurs (ses autres événements). */
  staffBusy?: Readonly<Record<string, readonly Period[]>>;
  /** Matériel obligatoire : quantité par élève et occupation de chaque exemplaire. */
  equipment?: ReadonlyArray<{ quantity: number; units: ReadonlyArray<readonly Period[]> }>;
}

/** Un jour civil est-il dans une fermeture datée ? */
export function isClosed(slots: SlotsModule, date: CivilDate): boolean {
  const key = civilKey(date);
  return (slots.closures ?? []).some((closure) => closure.from <= key && key <= closure.to);
}

/** Fenêtre de réservation : au plus tôt `closesHoursBefore` après maintenant, au plus tard J-N. */
export function slotWindow(slots: SlotsModule, now: Date): { earliest: Date; latest: Date | null } {
  return {
    earliest: new Date(now.getTime() + (slots.closesHoursBefore ?? 0) * HOUR),
    latest: slots.opensDaysBefore ? new Date(now.getTime() + slots.opensDaysBefore * DAY) : null,
  };
}

/**
 * Créneaux libres, calculés à la volée (rien n'est écrit avant la réservation) : départs toutes
 * les `intervalMinutes` dans les plages de chaque jour ouvert, plus un départ juste après chaque
 * créneau pris (pause comprise) pour ne pas perdre de temps. Un départ est proposé si le créneau
 * tient dans la plage et la fenêtre de réservation, et si, pause comprise de part et d'autre :
 * - sans intervenant, rien d'autre n'occupe ce moment (sauf le même créneau, à compléter) ;
 * - avec intervenants, au moins l'un d'eux est libre ;
 * - le matériel obligatoire a assez d'exemplaires libres.
 * Les heures sont murales dans le fuseau de l'espace (changements d'heure compris).
 */
export function generateSlots(input: SlotInput): Slot[] {
  const { slots, timeZone, now, taken } = input;
  const duration = input.durationMinutes * MINUTE;
  const pause = (slots.breakMinutes ?? 0) * MINUTE;
  const interval = slots.intervalMinutes * MINUTE;
  const seats = slots.seatsPerSlot ?? 1;
  const members = slots.memberIds ?? [];
  const { earliest, latest } = slotWindow(slots, now);
  const found = new Map<number, Slot>();

  const equipmentFree = (period: Period) =>
    (input.equipment ?? []).every(
      (need) =>
        need.units.filter((busy) => !busy.some((entry) => overlaps(entry, period))).length >=
        need.quantity,
    );
  const inWindow = (startsAt: Date) =>
    startsAt > now && startsAt >= earliest && (latest === null || startsAt <= latest);

  for (let offset = 0; offset < input.days; offset++) {
    const date = addDays(input.from, offset);
    if (isClosed(slots, date)) continue;
    const ranges = slots.weekly[weekdayOf(date.year, date.month, date.day)] ?? [];
    for (const range of ranges) {
      const rangeStart = at(date, range.start, timeZone).getTime();
      const rangeEnd = at(date, range.end, timeZone).getTime();
      const inside = taken.filter(
        (entry) => entry.startsAt.getTime() < rangeEnd && entry.endsAt.getTime() > rangeStart,
      );
      const starts = new Set<number>();
      for (let start = rangeStart; start + duration <= rangeEnd; start += interval) {
        starts.add(start);
      }
      for (const entry of inside) starts.add(entry.endsAt.getTime() + pause);

      for (const start of [...starts].sort((a, b) => a - b)) {
        const period = { startsAt: new Date(start), endsAt: new Date(start + duration) };
        if (start < rangeStart || start + duration > rangeEnd || !inWindow(period.startsAt)) {
          continue;
        }
        const padded = {
          startsAt: new Date(start - pause),
          endsAt: new Date(start + duration + pause),
        };
        const options: SlotOption[] = [];
        // Le même créneau, déjà réservé avec des places : on le complète.
        for (const entry of inside) {
          if (
            entry.eventId &&
            entry.startsAt.getTime() === start &&
            entry.endsAt.getTime() === start + duration &&
            (entry.capacity === null || entry.seatsHeld < entry.capacity)
          ) {
            options.push({
              staffMemberId: entry.staffMemberId,
              eventId: entry.eventId,
              seatsLeft: entry.capacity === null ? seats : entry.capacity - entry.seatsHeld,
            });
          }
        }
        const clashes = inside.filter(
          (entry) =>
            overlaps(entry, padded) &&
            !options.some((option) => option.eventId !== null && option.eventId === entry.eventId),
        );
        if (equipmentFree(period)) {
          if (members.length === 0) {
            if (clashes.length === 0 && options.length === 0) {
              options.push({ staffMemberId: null, eventId: null, seatsLeft: seats });
            }
          } else {
            for (const memberId of members) {
              if (options.some((option) => option.staffMemberId === memberId)) continue;
              const busy =
                clashes.some((entry) => entry.staffMemberId === memberId) ||
                (input.staffBusy?.[memberId] ?? []).some((entry) => overlaps(entry, padded));
              if (!busy) options.push({ staffMemberId: memberId, eventId: null, seatsLeft: seats });
            }
          }
        }
        if (options.length > 0 && !found.has(start)) found.set(start, { ...period, options });
      }
    }
  }
  return [...found.values()].sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime());
}

/** Le moment de la journée d'un créneau, pour regrouper les heures sur la page publique. */
export function dayMoment(startsAt: Date, timeZone: string): string {
  const { hour, minute } = toZonedParts(startsAt, timeZone);
  const time = hour * 60 + minute;
  if (time < 12 * 60) return "Matin";
  if (time < 16 * 60 + 30) return "Après-midi";
  if (time < 18 * 60 + 30) return "Fin d'après-midi";
  return "Soir";
}

/**
 * Choisit l'option d'un créneau : l'intervenant demandé, sinon (« Peu importe ») d'abord un
 * créneau à compléter, puis le premier intervenant libre. null si plus rien ne convient.
 */
export function pickSlotOption(
  slot: Slot | undefined,
  staffMemberId: string | null,
  seats: number,
): SlotOption | null {
  const fitting = (slot?.options ?? []).filter((option) => option.seatsLeft >= seats);
  if (staffMemberId) return fitting.find((option) => option.staffMemberId === staffMemberId) ?? null;
  return fitting.find((option) => option.eventId !== null) ?? fitting[0] ?? null;
}

/** Nombre de créneaux libres de la semaine suivante (pastille de l'éditeur). */
export function nextWeekSlotCount(
  slots: SlotsModule,
  durationMinutes: number,
  timeZone: string,
  now: Date,
): number {
  const monday = addDays(mondayOf(civilDateOf(now, timeZone)), 7);
  return generateSlots({
    // L'aperçu ignore la fenêtre de réservation : il montre ce que la semaine contient.
    slots: { ...slots, opensDaysBefore: undefined, closesHoursBefore: undefined },
    durationMinutes,
    timeZone,
    from: monday,
    days: 7,
    now,
    taken: [],
  }).length;
}
