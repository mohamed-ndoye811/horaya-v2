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

/** Présence à un événement passé, d'après le check-in (fiche client). */
export const ATTENDANCE_BADGE = {
  present: { label: "Venu·e", tone: "info" },
  absent: { label: "Absent·e", tone: "danger" },
} satisfies Record<string, { label: string; tone: Tone }>;

/**
 * Statut affiché d'un événement : on précise « Presque complet » (≥ 80 %) et « Complet »
 * pour un événement publié, sinon publié / brouillon / annulé.
 */
export function eventStatusBadge(
  status: EventStatus,
  fill?: { seatsHeld: number; capacity: number | null },
): { label: string; tone: Tone } {
  if (status === "draft") return { label: "Brouillon", tone: "draft" };
  if (status === "cancelled") return { label: "Annulé", tone: "danger" };
  if (fill?.capacity) {
    if (fill.seatsHeld >= fill.capacity) return { label: "Complet", tone: "info" };
    if (fill.seatsHeld / fill.capacity >= 0.8) return { label: "Presque complet", tone: "warning" };
  }
  return { label: "Publié", tone: "success" };
}
