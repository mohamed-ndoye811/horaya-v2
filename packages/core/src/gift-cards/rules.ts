import type { GiftCard, GiftCardMovement, GiftCardSettings } from "./model";

/** Sans I, L, O, 0 ni 1 : un code se lit au téléphone et se recopie sans erreur. */
export const GIFT_CARD_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
/** 8 caractères depuis le lot 34 ; les bons existants gardent leur code de 4. */
const SUFFIX_LENGTH = 8;

/** Préfixe tiré du nom de l'espace : majuscules sans accents, 5 lettres au plus (« Terre & Feu » donne TERRE). */
export function giftCardPrefix(name: string): string {
  const letters = name
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toUpperCase()
    .replace(/[^A-Z\s]/g, " ")
    .trim()
    .split(/\s+/)
    .filter((word) => word.length >= 3)[0];
  return (letters ?? "BON").slice(0, 5);
}

/** `TERRE-8K2F7M3P` ; `random` rend un octet (0-255), injectable pour les tests. */
export function generateGiftCardCode(
  name: string,
  random: () => number = () => globalThis.crypto.getRandomValues(new Uint8Array(1))[0] ?? 0,
): string {
  // On rejette les octets qui biaiseraient le tirage (256 n'est pas multiple de 31).
  const limit = 256 - (256 % GIFT_CARD_ALPHABET.length);
  let suffix = "";
  while (suffix.length < SUFFIX_LENGTH) {
    const byte = random();
    if (byte < limit) suffix += GIFT_CARD_ALPHABET[byte % GIFT_CARD_ALPHABET.length];
  }
  return `${giftCardPrefix(name)}-${suffix}`;
}

/** Code saisi par un client : espaces, minuscules et tirets oubliés ne comptent pas. */
export function normalizeGiftCardCode(input: string): string {
  const compact = input.toUpperCase().replace(/[\s_–—-]+/g, "");
  const match = /^([A-Z]{3,5})([A-Z0-9]{8}|[A-Z0-9]{4})$/.exec(compact);
  return match ? `${match[1]}-${match[2]}` : compact;
}

/** Solde : somme du journal des mouvements. */
export function giftCardBalance(movements: ReadonlyArray<Pick<GiftCardMovement, "amountCents">>) {
  return movements.reduce((total, movement) => total + movement.amountCents, 0);
}

/** Échéance : N mois après le paiement (le 31 janvier + 1 mois donne le 28 ou 29 février). */
export function giftCardExpiry(from: Date, months: number): Date {
  const target = new Date(from);
  const day = target.getUTCDate();
  target.setUTCDate(1);
  target.setUTCMonth(target.getUTCMonth() + months);
  const lastDay = new Date(
    Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0),
  ).getUTCDate();
  target.setUTCDate(Math.min(day, lastDay));
  return target;
}

export type GiftCardState = "pending" | "active" | "expired" | "used" | "cancelled";

export function giftCardState(
  card: Pick<GiftCard, "status" | "expiresAt">,
  balanceCents: number,
  now: Date,
): GiftCardState {
  if (card.status !== "active") return card.status;
  if (card.expiresAt && card.expiresAt <= now) return "expired";
  return balanceCents > 0 ? "active" : "used";
}

/** Montant déduit d'un prix : le solde, dans la limite de ce qui reste à payer. */
export const giftCardApplicableCents = (balanceCents: number, dueCents: number) =>
  Math.max(0, Math.min(balanceCents, dueCents));

/** Le montant d'achat est-il permis par les réglages ? Renvoie le message d'erreur, sinon null. */
export function giftCardAmountError(
  settings: GiftCardSettings,
  amountCents: number,
): string | null {
  if (settings.amountsCents.includes(amountCents)) return null;
  if (!settings.customAmount) return "Choisis l'un des montants proposés";
  if (amountCents < settings.minCents || amountCents > settings.maxCents) {
    const euros = (cents: number) => `${cents / 100} €`.replace(".", ",");
    return `Le montant doit être entre ${euros(settings.minCents)} et ${euros(settings.maxCents)}`;
  }
  return null;
}
