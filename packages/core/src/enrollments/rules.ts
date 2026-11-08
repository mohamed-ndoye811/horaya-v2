import { isWithinFreeCancellation } from "../bookings/cancellation";
import type { Event } from "../events/model";
import { ConflictError } from "../shared/errors";

/** Séances ouvertes à l'inscription : publiées et pas encore commencées, dans l'ordre. */
export function remainingSessions<T extends Pick<Event, "status" | "startsAt">>(
  events: readonly T[],
  now: Date,
): T[] {
  return events
    .filter((event) => event.status === "published" && event.startsAt > now)
    .sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime());
}

export interface SessionPlaces {
  startsAt: Date;
  /** null = places illimitées. */
  capacity: number | null;
  seatsHeld: number;
  /** Le client a déjà une réservation active sur cette séance. */
  alreadyBooked: boolean;
}

const sessionDay = (date: Date, timeZone: string) =>
  new Intl.DateTimeFormat("fr-FR", { weekday: "short", day: "numeric", month: "short", timeZone })
    .format(date)
    .replaceAll(".", "");

/**
 * Une inscription prend une place dans chaque séance restante : tout ou rien. Refusée en
 * nommant les séances complètes, ou celles que le client a déjà réservées à l'unité.
 */
export function assertEnrollmentFits(sessions: readonly SessionPlaces[], timeZone: string): void {
  if (sessions.length === 0) {
    throw new ConflictError("Il n'y a plus de séance à venir dans cette série");
  }
  const days = (list: readonly SessionPlaces[]) =>
    list.map((session) => sessionDay(session.startsAt, timeZone)).join(", ");
  const booked = sessions.filter((session) => session.alreadyBooked);
  if (booked.length > 0) {
    throw new ConflictError(
      `Déjà une réservation à la séance pour : ${days(booked)}. Annule-la avant d'inscrire à toute la série.`,
    );
  }
  const full = sessions.filter(
    (session) => session.capacity !== null && session.seatsHeld >= session.capacity,
  );
  if (full.length > 0) {
    throw new ConflictError(
      `${full.length > 1 ? "Ces séances sont complètes" : "Cette séance est complète"} : ${days(full)}. L'inscription à toute la série n'est pas possible.`,
    );
  }
}

export interface ProgressSession {
  startsAt: Date;
  endsAt: Date;
  absent: boolean;
}

export type SessionState = "done" | "current" | "upcoming";

/**
 * Où en est une inscription : « séance 8 sur 12 », absences, fin de la série.
 * La séance en cours (ou la prochaine) est la courante.
 */
export function enrollmentProgress<T extends ProgressSession>(sessions: readonly T[], now: Date) {
  const sorted = [...sessions].sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime());
  const done = sorted.filter((session) => session.endsAt <= now).length;
  const total = sorted.length;
  return {
    total,
    /** Numéro de la séance courante (1 à N). */
    current: Math.min(done + 1, total),
    finished: total > 0 && done === total,
    absences: sorted.filter((session) => session.absent).length,
    endsAt: sorted.at(-1)?.endsAt ?? null,
    /** Prochaine séance où le client est attendu (pas d'absence signalée). */
    next: sorted.find((session) => session.endsAt > now && !session.absent) ?? null,
    sessions: sorted.map((session, index) => ({
      ...session,
      state: (index < done ? "done" : index === done ? "current" : "upcoming") as SessionState,
    })),
  };
}

/**
 * Prix d'une inscription en cours de route : prix de la série × séances restantes ÷ séances
 * totales, arrondi à l'euro. Au prorata seulement si la série le prévoit et qu'il manque des
 * séances ; jamais au-dessus du prix de la série.
 */
export function enrollmentQuote(input: {
  fullCents: number;
  remaining: number;
  total: number;
  prorata: boolean;
}) {
  const { fullCents, remaining, total } = input;
  const prorated = input.prorata && total > 0 && remaining < total;
  const priceCents = prorated
    ? Math.min(fullCents, Math.round((fullCents * remaining) / total / 100) * 100)
    : fullCents;
  return { priceCents, fullCents, remaining, total, prorated };
}

/** Une absence donne une séance à rattraper : réglage ouvert, et signalée dans le délai d'annulation gratuite. */
export function isMakeupEarned(input: {
  makeupAllowed: boolean;
  startsAt: Date;
  now: Date;
  freeCancellationHours: number;
}): boolean {
  return input.makeupAllowed && isWithinFreeCancellation(input);
}

/**
 * Pourquoi cette séance ne peut pas servir de rattrapage, ou null : une autre séance du même
 * type d'événement, publiée, pas commencée, et qui commence avant la fin de la série.
 * (Les places se vérifient sous le verrou de la séance.)
 */
export function makeupTargetIssue(input: {
  absent: { id: string; eventTypeId: string };
  target: Pick<Event, "id" | "eventTypeId" | "status" | "startsAt">;
  /** Fin de la dernière séance de la série. */
  seriesEndsAt: Date;
  now: Date;
}): string | null {
  const { absent, target } = input;
  if (target.id === absent.id) return "C'est la séance que tu as manquée";
  if (target.eventTypeId !== absent.eventTypeId) {
    return "Un rattrapage se prend sur le même type de cours";
  }
  if (target.status !== "published") return "Cette séance n'est pas ouverte";
  if (target.startsAt <= input.now) return "Cette séance a déjà commencé";
  if (target.startsAt >= input.seriesEndsAt) {
    return "Un rattrapage se prend avant la fin du trimestre";
  }
  return null;
}
