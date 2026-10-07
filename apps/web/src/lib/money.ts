/** « 120,00 » / « 120.5 » / « 1 200 » → centimes ; chaîne vide → 0 ; invalide → NaN. */
export function parseEuroToCents(value: string): number {
  const clean = value.replace(/[\s €]/g, "").replace(",", ".");
  if (clean === "") return 0;
  if (!/^\d+(\.\d{1,2})?$/.test(clean)) return Number.NaN;
  return Math.round(Number(clean) * 100);
}

/** Centimes → « 120,00 » pour pré-remplir un champ. */
export function centsToInput(cents: number): string {
  return (cents / 100).toFixed(2).replace(".", ",");
}
