import { plural } from "@/lib/format";

/** Durée de validité en mots : 365 j → « 1 an », 180 j → « 6 mois », 45 j → « 45 jours ». */
export function formatValidity(days: number): string {
  if (days % 365 === 0) return plural(days / 365, "an");
  if (days % 30 === 0) return `${days / 30} mois`;
  return plural(days, "jour");
}
