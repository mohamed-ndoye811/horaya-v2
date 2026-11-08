/** En attente de paiement, actif (utilisable), annulé. « Expiré » et « épuisé » se déduisent de l'échéance et du solde. */
export const GIFT_CARD_STATUSES = ["pending", "active", "cancelled"] as const;
export type GiftCardStatus = (typeof GIFT_CARD_STATUSES)[number];

/** Émission (+), utilisation (−), annulation d'une utilisation (+), annulation du bon (−), ajustement (±). */
export const GIFT_CARD_MOVEMENT_KINDS = ["issue", "use", "restore", "cancel", "adjust"] as const;
export type GiftCardMovementKind = (typeof GIFT_CARD_MOVEMENT_KINDS)[number];

export const GIFT_CARD_SOURCES = ["public_page", "admin", "counter"] as const;
export type GiftCardSource = (typeof GIFT_CARD_SOURCES)[number];
