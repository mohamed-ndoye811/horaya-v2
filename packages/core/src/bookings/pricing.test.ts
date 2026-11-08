import { describe, expect, it } from "vitest";
import { enrollmentQuote } from "../enrollments/rules";
import { eventMoney } from "../events/rules";
import { EVENT_TYPE_TEMPLATES } from "../events/templates";
import { giftCardApplicableCents } from "../gift-cards/rules";
import type { EventModules, PricingModule } from "../modules/registry";
import { pricingModuleSchema } from "../modules/registry";
import { moduleSummary } from "../modules/rules";
import { amountDueOnline } from "../payments/rules";
import { ValidationError } from "../shared/errors";
import {
  acceptsGiftCards,
  acceptsPass,
  depositFor,
  passSessionsFor,
  priceDetail,
  priceLinesLabel,
  quoteBooking,
  selectionFor,
  selectionFromLines,
} from "./pricing";
import { reschedulePricing } from "./reschedule";

const pricing: PricingModule = {
  rates: [
    { id: "plein", name: "Plein", priceCents: 4500 },
    { id: "reduit", name: "Réduit", priceCents: 3500, description: "étudiant, demandeur d'emploi" },
    { id: "enfant", name: "Enfant", priceCents: 2000 },
  ],
  options: [
    { id: "cuisson", name: "Cuisson et émaillage", priceCents: 800, per: "participant" },
    { id: "tablier", name: "Tablier", priceCents: 300, per: "booking", max: 3 },
  ],
};
const event = (modules: EventModules = { pricing }, paymentMode = "online" as const) => ({
  priceCents: 4500,
  paymentMode,
  modules,
});

describe("quoteBooking : tarifs par participant", () => {
  it("sans choix, chaque place prend le tarif par défaut", () => {
    const quote = quoteBooking(event(), 2);
    expect(quote.amountCents).toBe(9000);
    expect(quote.lines).toEqual([
      { kind: "rate", id: "plein", label: "Plein", unitCents: 4500, quantity: 2, totalCents: 9000 },
    ]);
    expect(quote.depositCents).toBeNull();
  });

  it("1 plein + 1 enfant, une ligne par tarif dans l'ordre du module", () => {
    const quote = quoteBooking(event(), 3, { rates: ["enfant", "plein", "enfant"] });
    expect(quote.amountCents).toBe(4500 + 2 * 2000);
    expect(quote.lines.map((line) => [line.id, line.quantity])).toEqual([
      ["plein", 1],
      ["enfant", 2],
    ]);
  });

  it("le tarif par défaut désigné remplit les places sans choix", () => {
    const quote = quoteBooking(event({ pricing: { ...pricing, defaultRateId: "reduit" } }), 2, {
      rates: ["plein"],
    });
    expect(quote.amountCents).toBe(4500 + 3500);
  });

  it("refuse un tarif inconnu ou plus de tarifs que de places", () => {
    expect(() => quoteBooking(event(), 1, { rates: ["vip"] })).toThrow(ValidationError);
    expect(() => quoteBooking(event(), 1, { rates: ["plein", "plein"] })).toThrow(/Plus de tarifs/);
  });

  it("sans module : un tarif « Plein » au prix de l'événement", () => {
    const quote = quoteBooking(event({}), 3);
    expect(quote.amountCents).toBe(13500);
    expect(quote.lines).toHaveLength(1);
    expect(quote.lines[0]).toMatchObject({ id: "plein", label: "Plein", quantity: 3 });
  });

  it("gratuit : rien à payer, pas de détail", () => {
    expect(quoteBooking(event({ pricing }, "free" as never), 2, { rates: ["reduit"] })).toEqual({
      lines: [],
      amountCents: 0,
      depositCents: null,
    });
    expect(quoteBooking({ ...event({}), priceCents: 0 }, 2).lines).toEqual([]);
  });
});

describe("quoteBooking : options", () => {
  it("par participant : au plus une par place", () => {
    const quote = quoteBooking(event(), 2, { options: { cuisson: 2 } });
    expect(quote.amountCents).toBe(9000 + 1600);
    expect(quote.lines.at(-1)).toMatchObject({ kind: "option", quantity: 2, totalCents: 1600 });
    expect(() => quoteBooking(event(), 2, { options: { cuisson: 3 } })).toThrow(/Quantité/);
  });

  it("par inscription : au plus la quantité maximale, quel que soit le nombre de places", () => {
    expect(quoteBooking(event(), 1, { options: { tablier: 3 } }).amountCents).toBe(4500 + 900);
    expect(() => quoteBooking(event(), 5, { options: { tablier: 4 } })).toThrow(ValidationError);
  });

  it("une quantité nulle n'ajoute pas de ligne ; une option inconnue est refusée", () => {
    expect(quoteBooking(event(), 1, { options: { cuisson: 0 } }).lines).toHaveLength(1);
    expect(() => quoteBooking(event(), 1, { options: { gateau: 1 } })).toThrow(/option/);
    expect(() => quoteBooking(event(), 1, { options: { cuisson: 0.5 } })).toThrow(ValidationError);
  });

  it("le détail ne s'affiche que s'il apprend quelque chose", () => {
    expect(priceDetail(quoteBooking(event({}), 2).lines)).toBeNull();
    expect(priceDetail([])).toBeNull();
    expect(priceDetail(quoteBooking(event(), 1, { rates: ["reduit"] }).lines)).toBe("1 Réduit");
  });

  it("total = tarifs + options", () => {
    const quote = quoteBooking(event(), 2, {
      rates: ["plein", "reduit"],
      options: { cuisson: 1, tablier: 2 },
    });
    expect(quote.amountCents).toBe(4500 + 3500 + 800 + 600);
    expect(priceLinesLabel(quote.lines)).toBe(
      "1 Plein, 1 Réduit · Cuisson et émaillage · Tablier × 2",
    );
  });
});

describe("acompte", () => {
  it("en pourcentage du total, arrondi au centime le plus proche", () => {
    expect(depositFor({ percent: 30 }, 4500, 1)).toBe(1350);
    expect(depositFor({ percent: 33 }, 1001, 1)).toBe(330); // 330,33 → 330
    expect(depositFor({ percent: 50 }, 1001, 1)).toBe(501); // 500,5 → 501
  });

  it("montant fixe par place, jamais plus que le total", () => {
    expect(depositFor({ amountCents: 2000 }, 9000, 2)).toBe(4000);
    expect(depositFor({ amountCents: 5000 }, 4500, 1)).toBe(4500);
  });

  it("ne s'applique qu'en mode acompte, sur le total options comprises", () => {
    const modules = { pricing, deposit: { percent: 30 } };
    const quote = quoteBooking(event(modules, "deposit" as never), 2, { options: { cuisson: 2 } });
    expect(quote.depositCents).toBe(Math.round(10600 * 0.3));
    expect(amountDueOnline({ paymentMode: "deposit", ...quote })).toBe(3180);
    expect(quoteBooking(event(modules), 2).depositCents).toBeNull();
  });
});

describe("moyens acceptés", () => {
  it("par défaut, toutes les cartes et les bons cadeaux", () => {
    expect(acceptsGiftCards(undefined)).toBe(true);
    expect(acceptsPass(undefined, { planId: null })).toBe(true);
    expect(passSessionsFor(undefined, 3)).toBe(3);
  });

  it("formules choisies, séances par place, bons refusés", () => {
    const methods = { passPlanIds: ["a"], sessionsPerSeat: 2, giftCards: false };
    expect(acceptsPass(methods, { planId: "a" })).toBe(true);
    expect(acceptsPass(methods, { planId: "b" })).toBe(false);
    expect(acceptsPass(methods, { planId: null })).toBe(false);
    expect(acceptsPass({ passes: false }, { planId: "a" })).toBe(false);
    expect(passSessionsFor(methods, 3)).toBe(6);
    expect(acceptsGiftCards(methods)).toBe(false);
  });

  it("un bon cadeau couvre au plus le total de la réservation", () => {
    const { amountCents } = quoteBooking(event(), 1, { options: { cuisson: 1 } });
    expect(giftCardApplicableCents(10_000, amountCents)).toBe(5300);
    expect(giftCardApplicableCents(2000, amountCents)).toBe(2000);
  });
});

describe("prorata d'une inscription à la série", () => {
  it("part du prix des séances au tarif par défaut, arrondi à l'euro", () => {
    const { priceCents } = eventMoney(
      {
        modules: { pricing: { ...pricing, defaultRateId: "reduit" } },
        priceCents: 0,
        paymentMode: "online",
      },
      {},
    );
    const quote = enrollmentQuote({
      fullCents: priceCents * 12,
      remaining: 7,
      total: 12,
      prorata: true,
    });
    expect(quote.priceCents).toBe(24_500); // 420 € × 7 / 12 = 245 €
  });
});

describe("changement de date avec écart", () => {
  const lines = quoteBooking(event(), 2, {
    rates: ["plein", "enfant"],
    options: { cuisson: 2 },
  }).lines;
  const booking = {
    seats: 2,
    amountCents: 8100,
    depositCents: null,
    paymentMode: "online" as const,
    paymentStatus: "paid" as const,
    priceLines: lines,
  };

  it("garde les tarifs et options choisis, aux prix de la nouvelle date", () => {
    const dearer = withPrices({ plein: 5000, enfant: 2500, cuisson: 1000 });
    const result = reschedulePricing({ booking, to: event({ pricing: dearer }), paidCents: 8100 });
    expect(result.amountCents).toBe(5000 + 2500 + 2000);
    expect(result).toMatchObject({ dueCents: 1400, overpaidCents: 0, paymentStatus: "none" });
    expect(priceLinesLabel(result.priceLines)).toBe("1 Plein, 1 Enfant · Cuisson et émaillage × 2");
  });

  it("un tarif disparu passe au tarif par défaut, une option disparue tombe", () => {
    const other: PricingModule = { rates: [{ id: "plein", name: "Plein", priceCents: 4000 }] };
    const result = reschedulePricing({ booking, to: event({ pricing: other }), paidCents: 8100 });
    expect(result.amountCents).toBe(8000);
    expect(result).toMatchObject({ dueCents: 0, overpaidCents: 100, paymentStatus: "paid" });
  });

  it("une réservation d'avant le lot 35 prend le tarif par défaut", () => {
    const legacy = { ...booking, priceLines: [], amountCents: 9000 };
    expect(reschedulePricing({ booking: legacy, to: event(), paidCents: 9000 }).amountCents).toBe(
      9000,
    );
  });

  it("le choix relu puis adapté ne dépasse jamais les maximums", () => {
    const selection = selectionFromLines(lines);
    expect(selection).toEqual({ rates: ["plein", "enfant"], options: { cuisson: 2 } });
    expect(selectionFor(event(), 1, selection)).toEqual({
      rates: ["plein"],
      options: { cuisson: 1 },
    });
  });
});

function withPrices(prices: Record<string, number>): PricingModule {
  return eventMoney({ modules: { pricing }, priceCents: 0, paymentMode: "online" }, { prices })
    .modules.pricing as PricingModule;
}

describe("l'argent d'un événement", () => {
  it("reprend les tarifs du type, change les prix, et affiche le tarif par défaut", () => {
    const money = eventMoney(
      { modules: { pricing }, priceCents: 999, paymentMode: "online" },
      { prices: { plein: 5000, cuisson: 900 }, deposit: { percent: 20 } },
    );
    expect(money.priceCents).toBe(5000);
    expect(money.modules.pricing?.rates.map((rate) => rate.name)).toEqual([
      "Plein",
      "Réduit",
      "Enfant",
    ]);
    expect(money.modules.pricing?.options?.[0]?.priceCents).toBe(900);
    expect(money.modules.deposit).toEqual({ percent: 20 });
    expect(
      eventMoney({ modules: money.modules, priceCents: 0, paymentMode: "free" }, { deposit: null }),
    ).toMatchObject({ priceCents: 0, modules: { pricing: money.modules.pricing } });
  });

  it("valide le module : un tarif au moins, identifiants uniques, défaut connu", () => {
    expect(pricingModuleSchema.safeParse({ rates: [] }).success).toBe(false);
    expect(
      pricingModuleSchema.safeParse({
        rates: [{ id: "a", name: "A", priceCents: 1 }],
        options: [{ id: "a", name: "B", priceCents: 1, per: "booking" }],
      }).success,
    ).toBe(false);
    expect(pricingModuleSchema.safeParse({ ...pricing, defaultRateId: "vip" }).success).toBe(false);
    expect(pricingModuleSchema.safeParse(pricing).success).toBe(true);
  });

  it("les modèles ont des tarifs d'exemple, au prix par défaut du modèle", () => {
    for (const template of EVENT_TYPE_TEMPLATES) {
      const { pricing: templatePricing } = template.modules;
      if (!templatePricing) continue;
      expect(templatePricing.rates[0]?.priceCents, template.id).toBe(template.defaultPriceCents);
    }
    const names = (id: string) =>
      EVENT_TYPE_TEMPLATES.find((template) => template.id === id)?.modules.pricing?.rates.map(
        (rate) => rate.name,
      );
    expect(names("cours-collectif")).toEqual(["Plein", "Réduit"]);
    expect(names("privatisation")).toEqual(["Adulte", "Enfant"]);
  });

  it("résume le module comme la maquette 9.1", () => {
    const context = {
      noun: "inscription",
      structure: { freeCancellationHours: 48, lateCancellationRefundPercent: 0 },
    };
    expect(
      moduleSummary(
        "pricing",
        { pricing: { rates: pricing.rates.slice(0, 2), options: pricing.options?.slice(0, 1) } },
        context,
      ),
    ).toBe("Plein 45 € · Réduit 35 € (étudiant, demandeur d'emploi) · Cuisson et émaillage + 8 €");
    expect(moduleSummary("deposit", { deposit: { percent: 30 } }, context)).toBe(
      "30 % à l'inscription · le reste sur place",
    );
    expect(
      moduleSummary("payment_methods", { payment_methods: { giftCards: false } }, context),
    ).toBe("Toutes les cartes de séances · 1 séance par place · pas de bon cadeau");
  });
});
