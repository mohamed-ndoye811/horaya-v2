import type { BookingStatus, EventStatus } from "@horaya/core";
import type { Tone } from "./badge";

/** Libellés et couleurs des statuts métier, partagés par toutes les listes. */
export const BOOKING_STATUS_BADGE: Record<BookingStatus, { label: string; tone: Tone }> = {
  pending: { label: "En attente", tone: "warning" },
  confirmed: { label: "Confirmée", tone: "success" },
  waitlisted: { label: "Liste d'attente", tone: "info" },
  refused: { label: "Refusée", tone: "danger" },
  cancelled: { label: "Annulée", tone: "draft" },
};

/**
 * Statut d'une réservation, en tenant compte des cours à l'année : une séance réservée par une
 * inscription à la série s'affiche « Inscrit·e au trimestre », ou « Absence signalée ».
 */
export function bookingStatusBadge(booking: {
  status: BookingStatus;
  enrollmentId?: string | null;
  absentAt?: Date | null;
}): { label: string; tone: Tone } {
  if (booking.absentAt) return { label: "Absence signalée", tone: "neutral" };
  if (booking.enrollmentId && booking.status === "confirmed") {
    return { label: "Inscrit·e au trimestre", tone: "info" };
  }
  return BOOKING_STATUS_BADGE[booking.status];
}

/** Présence à un événement passé, d'après le check-in (fiche client). */
export const ATTENDANCE_BADGE = {
  present: { label: "Venu·e", tone: "info" },
  absent: { label: "Absent·e", tone: "danger" },
} satisfies Record<string, { label: string; tone: Tone }>;

/**
 * Statut affiché d'un événement publié : « Complet », « Presque complet » (≥ 80 %), ou
 * « Peu rempli · J-3 » quand il démarre dans 3 jours ou moins à moins d'un tiers rempli.
 * Sinon publié / brouillon / annulé.
 */
export function eventStatusBadge(
  status: EventStatus,
  fill?: { seatsHeld: number; capacity: number | null; startsAt?: Date },
  now = new Date(),
): { label: string; tone: Tone } {
  if (status === "draft") return { label: "Brouillon", tone: "draft" };
  if (status === "cancelled") return { label: "Annulé", tone: "danger" };
  if (fill?.capacity) {
    if (fill.seatsHeld >= fill.capacity) return { label: "Complet", tone: "ink" };
    if (fill.seatsHeld / fill.capacity >= 0.8) return { label: "Presque complet", tone: "warning" };
    if (fill.startsAt && fill.startsAt > now && fill.seatsHeld / fill.capacity < 1 / 3) {
      const days = Math.ceil((fill.startsAt.getTime() - now.getTime()) / 86_400_000);
      if (days <= 3) return { label: `Peu rempli · J-${days}`, tone: "danger" };
    }
  }
  return { label: "Publié", tone: "success" };
}
