import type { BookingStatus } from "./types";

/** Le pointage des arrivées ouvre la veille : 24 h avant le début de l'événement. */
export const CHECK_IN_OPENS_BEFORE_HOURS = 24;

export function isCheckInOpen(event: { startsAt: Date }, now: Date): boolean {
  return now.getTime() >= event.startsAt.getTime() - CHECK_IN_OPENS_BEFORE_HOURS * 3_600_000;
}

/** Présence d'un client à un événement : « Venue », « Absente », ou rien à dire. */
export type Attendance = "present" | "absent" | null;

/**
 * Une réservation confirmée sans pointage n'est « absente » qu'une fois l'événement
 * terminé, et seulement si l'équipe a fait le check-in de cet événement (sinon on ne
 * sait pas qui est venu).
 */
export function attendanceOf(
  booking: { status: BookingStatus; checkedInAt: Date | null },
  event: { endsAt: Date; checkInUsed: boolean },
  now: Date,
): Attendance {
  if (booking.checkedInAt) return "present";
  if (booking.status !== "confirmed" || !event.checkInUsed) return null;
  return event.endsAt <= now ? "absent" : null;
}

/** Taux de présence en pourcentage, ou null s'il n'y a encore rien à mesurer. */
export function attendanceRate(attendances: Attendance[]): number | null {
  const known = attendances.filter((entry) => entry !== null);
  if (known.length === 0) return null;
  const present = known.filter((entry) => entry === "present").length;
  return Math.round((present / known.length) * 100);
}
