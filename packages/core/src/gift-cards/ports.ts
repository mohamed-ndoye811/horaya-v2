import type {
  GiftCard,
  GiftCardMovement,
  GiftCardSettings,
  NewGiftCard,
  NewGiftCardMovement,
} from "./model";

export interface GiftCardPatch {
  status?: GiftCard["status"];
  paidAt?: Date;
  expiresAt?: Date;
  cancelledAt?: Date;
}

export interface GiftCardRepository {
  /** Renvoie null si le code existe déjà dans l'espace (on en tire un autre). */
  insert(card: NewGiftCard): Promise<GiftCard | null>;
  /** Relit le bon en verrouillant sa ligne : les mouvements d'un même bon se font à la file. */
  lock(organizationId: string, giftCardId: string): Promise<GiftCard | null>;
  lockByCode(organizationId: string, code: string): Promise<GiftCard | null>;
  update(organizationId: string, giftCardId: string, patch: GiftCardPatch): Promise<GiftCard>;
  addMovement(movement: NewGiftCardMovement): Promise<GiftCardMovement>;
  listMovements(giftCardId: string): Promise<GiftCardMovement[]>;
  /** Mouvements d'utilisation et de restitution liés à une réservation. */
  listBookingMovements(bookingId: string): Promise<GiftCardMovement[]>;
  getSettings(organizationId: string): Promise<GiftCardSettings>;
  setSettings(organizationId: string, settings: GiftCardSettings): Promise<void>;
  organizationName(organizationId: string): Promise<string>;
}
