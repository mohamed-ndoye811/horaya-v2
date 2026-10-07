/** Nombre de jours facturés d'une location : toute journée entamée compte (24 h glissantes). */
export function rentalDays(startsAt: Date, endsAt: Date): number {
  return Math.max(1, Math.ceil((endsAt.getTime() - startsAt.getTime()) / 86_400_000));
}

export function priceRental(
  dailyRateCents: number | null,
  quantity: number,
  startsAt: Date,
  endsAt: Date,
): number {
  return (dailyRateCents ?? 0) * quantity * rentalDays(startsAt, endsAt);
}

/** Référence par défaut d'un article : initiales du nom + numéro libre (« Vidéoprojecteur Epson » → VE-001). */
export function referencePrefix(name: string): string {
  const words = name
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toUpperCase()
    .replace(/[^A-Z0-9 ]+/g, " ")
    .split(/\s+/)
    .filter(Boolean);
  const letters =
    words.length > 1
      ? `${words[0]?.[0] ?? ""}${words[1]?.[0] ?? ""}`
      : (words[0] ?? "AR").slice(0, 2);
  return letters.padEnd(2, "X");
}
