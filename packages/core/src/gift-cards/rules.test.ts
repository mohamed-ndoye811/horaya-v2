import { describe, expect, it } from "vitest";
import {
  GIFT_CARD_ALPHABET,
  generateGiftCardCode,
  giftCardAmountError,
  giftCardApplicableCents,
  giftCardBalance,
  giftCardExpiry,
  giftCardPrefix,
  giftCardState,
  normalizeGiftCardCode,
} from "./rules";
import { DEFAULT_GIFT_CARD_SETTINGS } from "./schemas";

describe("code", () => {
  it("préfixe tiré du nom, sans accents ni symboles", () => {
    expect(giftCardPrefix("Terre & Feu")).toBe("TERRE");
    expect(giftCardPrefix("Atelier Céramique")).toBe("ATELI");
    expect(giftCardPrefix("L'Éclat")).toBe("ECLAT");
    expect(giftCardPrefix("42")).toBe("BON");
  });

  it("suffixe de 8 caractères sans caractères ambigus", () => {
    for (let index = 0; index < 200; index++) {
      const code = generateGiftCardCode("Terre & Feu");
      expect(code).toMatch(/^TERRE-[A-Z2-9]{8}$/);
      expect(code.slice(6)).not.toMatch(/[ILO01]/);
    }
    expect(GIFT_CARD_ALPHABET).toHaveLength(31);
  });

  it("rejette les octets qui biaiseraient le tirage", () => {
    const bytes = [255, 250, 0, 1, 2, 3, 4, 5, 6, 7];
    const code = generateGiftCardCode("Terre", () => bytes.shift() ?? 0);
    expect(code).toBe("TERRE-ABCDEFGH");
  });

  it("normalise la saisie du client", () => {
    expect(normalizeGiftCardCode(" terre 8k2f ")).toBe("TERRE-8K2F");
    expect(normalizeGiftCardCode("TERRE8K2F")).toBe("TERRE-8K2F");
    expect(normalizeGiftCardCode("TERRE-8K2F")).toBe("TERRE-8K2F");
    expect(normalizeGiftCardCode("terre 8k2f 7m3p")).toBe("TERRE-8K2F7M3P");
    expect(normalizeGiftCardCode("BON-8K2F")).toBe("BON-8K2F");
  });
});

describe("solde et état", () => {
  it("somme le journal", () => {
    expect(
      giftCardBalance([{ amountCents: 5000 }, { amountCents: -1800 }, { amountCents: 300 }]),
    ).toBe(3500);
  });

  it("échéance : N mois, fin de mois ramenée au dernier jour", () => {
    expect(giftCardExpiry(new Date("2026-11-08T10:00:00Z"), 12).toISOString()).toBe(
      "2027-11-08T10:00:00.000Z",
    );
    expect(giftCardExpiry(new Date("2027-01-31T10:00:00Z"), 1).toISOString()).toBe(
      "2027-02-28T10:00:00.000Z",
    );
    expect(giftCardExpiry(new Date("2027-12-15T10:00:00Z"), 3).toISOString()).toBe(
      "2028-03-15T10:00:00.000Z",
    );
  });

  it("état : en attente, actif, expiré, épuisé, annulé", () => {
    const now = new Date("2026-12-01T00:00:00Z");
    const future = new Date("2027-01-01T00:00:00Z");
    expect(giftCardState({ status: "pending", expiresAt: null }, 0, now)).toBe("pending");
    expect(giftCardState({ status: "active", expiresAt: future }, 100, now)).toBe("active");
    expect(giftCardState({ status: "active", expiresAt: future }, 0, now)).toBe("used");
    expect(giftCardState({ status: "active", expiresAt: now }, 100, now)).toBe("expired");
    expect(giftCardState({ status: "cancelled", expiresAt: future }, 0, now)).toBe("cancelled");
  });

  it("utilisation partielle : au plus le solde, au plus ce qui reste à payer", () => {
    expect(giftCardApplicableCents(5000, 3500)).toBe(3500);
    expect(giftCardApplicableCents(2000, 3500)).toBe(2000);
    expect(giftCardApplicableCents(2000, 0)).toBe(0);
  });
});

describe("montants d'achat", () => {
  it("accepte un montant proposé, ou libre dans les bornes", () => {
    const settings = { ...DEFAULT_GIFT_CARD_SETTINGS, enabled: true };
    expect(giftCardAmountError(settings, 5000)).toBeNull();
    expect(giftCardAmountError(settings, 4000)).toMatch(/montants proposés/);
    const free = { ...settings, customAmount: true };
    expect(giftCardAmountError(free, 4000)).toBeNull();
    expect(giftCardAmountError(free, 1000)).toMatch(/entre 20 € et 300 €/);
  });
});
