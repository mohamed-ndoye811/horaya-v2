/**
 * Références de réservation lisibles : PREFIXE-AAMM-NNNN (ex. HRY-2606-0388).
 * Le numéro vient d'un compteur par tenant et par mois (table reference_counter).
 */
export function referencePeriod(date: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    year: "2-digit",
    month: "2-digit",
  }).formatToParts(date);
  const year = parts.find((part) => part.type === "year")?.value ?? "00";
  const month = parts.find((part) => part.type === "month")?.value ?? "00";
  return `${year}${month}`;
}

export function formatBookingReference(prefix: string, period: string, sequence: number): string {
  return `${prefix}-${period}-${String(sequence).padStart(4, "0")}`;
}
