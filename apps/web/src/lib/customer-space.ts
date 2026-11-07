import type { BookingStatus } from "@horaya/core";
import type { Tone } from "@/components/ui/badge";
import { formatDayNumber, formatMonthShort, formatWeekdayShort } from "./format";

/** Espace client (lot 29) : règles d'affichage des réservations d'un client. */

const ACTIVE: ReadonlySet<BookingStatus> = new Set(["pending", "confirmed", "waitlisted"]);

/** À venir : active et pas encore terminée. Le reste (passé, annulé, refusé) va à l'historique. */
export const isUpcoming = (booking: { status: BookingStatus; endsAt: Date | null }, now: Date) =>
  ACTIVE.has(booking.status) && booking.endsAt !== null && booking.endsAt > now;

/** Pastille d'une carte de réservation (maquettes 8.2 et 8.5). */
export function bookingBadge(booking: {
  status: BookingStatus;
  paymentStatus: string;
  amountCents: number;
  /** Paiement en ligne attendu. */
  payable: boolean;
}): { label: string; tone: Tone } {
  if (booking.status === "cancelled") return { label: "Annulée", tone: "draft" };
  if (booking.status === "refused") return { label: "Non retenue", tone: "danger" };
  if (booking.status === "waitlisted") return { label: "Liste d'attente", tone: "warning" };
  if (booking.status === "pending") return { label: "À valider", tone: "info" };
  if (booking.payable) return { label: "À payer", tone: "warning" };
  if (booking.paymentStatus === "paid") return { label: "Payée", tone: "success" };
  return { label: "Confirmée", tone: "success" };
}

/** « Sam. 6 déc. », « Sam. 22 – dim. 23 nov. » (sur-titre des cartes, maquette 8.2). */
export function cardDate(start: Date, end: Date, timeZone: string): string {
  const day = (date: Date) =>
    `${formatWeekdayShort(date, timeZone)} ${formatDayNumber(date, timeZone)}`;
  const month = (date: Date) => formatMonthShort(date, timeZone).toLowerCase();
  // Un cours qui finit à minuit pile se termine la veille.
  const last = new Date(Math.max(start.getTime(), end.getTime() - 1));
  const sameDay = day(start) === day(last) && month(start) === month(last);
  if (sameDay) return `${day(start)} ${month(start)}`;
  const from = month(start) === month(last) ? day(start) : `${day(start)} ${month(start)}`;
  return `${from} – ${day(last).toLowerCase()} ${month(last)}`;
}

/** « 14 cours depuis mars 2026 · 2 annulés » (bandeau Historique). */
export function historySummary(
  history: Array<{ status: BookingStatus; startsAt: Date | null }>,
  timeZone: string,
): string {
  if (history.length === 0) return "Rien pour l'instant";
  const cancelled = history.filter((entry) => entry.status === "cancelled").length;
  const first = history
    .map((entry) => entry.startsAt)
    .filter((date): date is Date => date !== null)
    .sort((a, b) => a.getTime() - b.getTime())[0];
  const since = first
    ? ` depuis ${new Intl.DateTimeFormat("fr-FR", { timeZone, month: "long", year: "numeric" }).format(first)}`
    : "";
  return `${history.length} réservation${history.length > 1 ? "s" : ""}${since}${
    cancelled > 0 ? ` · ${cancelled} annulée${cancelled > 1 ? "s" : ""}` : ""
  }`;
}
