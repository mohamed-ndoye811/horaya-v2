import type { GiftCardMovementKind, GiftCardSource, GiftCardStatus } from "./types";

export interface GiftCard {
  id: string;
  organizationId: string;
  code: string;
  status: GiftCardStatus;
  initialCents: number;
  currency: string;
  purchaserName: string;
  purchaserEmail: string;
  recipientName: string;
  recipientEmail: string | null;
  message: string | null;
  source: GiftCardSource;
  /** Jeton de la page imprimable du bon (comme le code, il donne accès au bon : gardé en clair). */
  viewToken: string;
  paidAt: Date | null;
  expiresAt: Date | null;
  cancelledAt: Date | null;
  createdAt: Date;
}

export type NewGiftCard = Omit<
  GiftCard,
  "id" | "createdAt" | "paidAt" | "expiresAt" | "cancelledAt"
>;

export interface GiftCardMovement {
  id: string;
  organizationId: string;
  giftCardId: string;
  kind: GiftCardMovementKind;
  /** Signé : positif ajoute au solde, négatif le réduit. */
  amountCents: number;
  bookingId: string | null;
  note: string | null;
  createdAt: Date;
}

export type NewGiftCardMovement = Omit<GiftCardMovement, "id" | "createdAt">;

/** Réglages de l'organisateur (Paramètres › Bons cadeaux). */
export interface GiftCardSettings {
  enabled: boolean;
  /** Montants proposés, en centimes. */
  amountsCents: number[];
  /** Montant libre entre `minCents` et `maxCents`. */
  customAmount: boolean;
  minCents: number;
  maxCents: number;
  validityMonths: number;
  /** Texte d'accompagnement affiché sur la page d'achat et sur le bon. */
  message: string | null;
}
