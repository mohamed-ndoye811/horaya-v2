import type { Event } from "../events/model";
import type {
  DepositModule,
  PaymentMethodsModule,
  PriceOption,
  PricingModule,
  Rate,
} from "../modules/registry";
import { ValidationError } from "../shared/errors";

/**
 * Le prix d'une réservation (lot 35) : une seule fonction pure, `quoteBooking`, pour la page
 * publique, le comptoir, l'espace client, le changement de date, les bons et les cartes.
 * Montants en centimes entiers ; le seul arrondi est celui de l'acompte en pourcentage.
 */

/** Une ligne du détail, enregistrée sur la réservation : l'historique ne bouge plus si le type change. */
export interface PriceLine {
  kind: "rate" | "option";
  /** Identifiant du tarif ou de l'option dans le module « Tarifs et options ». */
  id: string;
  label: string;
  unitCents: number;
  quantity: number;
  totalCents: number;
}

/** Ce que le client choisit : un tarif par place (dans l'ordre des participants), des options. */
export interface PriceSelection {
  /** Tarif de chaque place ; place sans tarif : le tarif par défaut. */
  rates?: readonly string[];
  /** Quantité de chaque option (une option « par participant » : le nombre de participants qui la prennent). */
  options?: Readonly<Record<string, number>>;
}

type Priced = Pick<Event, "priceCents" | "paymentMode" | "modules">;

/** Identifiant du tarif unique d'un événement sans module « Tarifs et options ». */
export const BASE_RATE_ID = "plein";

/** Les tarifs d'un événement : ceux du module, sinon un tarif « Plein » au prix de l'événement. */
export function ratesOf(event: Pick<Event, "priceCents" | "modules">): Rate[] {
  return (
    event.modules.pricing?.rates ?? [
      { id: BASE_RATE_ID, name: "Plein", priceCents: event.priceCents },
    ]
  );
}

/** Le tarif choisi d'office (le premier si aucun n'est désigné). */
export function defaultRate(pricing: Pick<PricingModule, "rates" | "defaultRateId">): Rate {
  return (
    pricing.rates.find((rate) => rate.id === pricing.defaultRateId) ?? (pricing.rates[0] as Rate)
  );
}

/** Quantité au plus d'une option pour une réservation de `seats` places. */
export function optionMax(option: PriceOption, seats: number): number {
  return (option.max ?? 1) * (option.per === "participant" ? seats : 1);
}

/** Acompte : un pourcentage du total (arrondi au centime le plus proche) ou un montant par place, au plus le total. */
export function depositFor(deposit: DepositModule, amountCents: number, seats: number): number {
  const due =
    deposit.percent !== undefined
      ? Math.round((amountCents * deposit.percent) / 100)
      : (deposit.amountCents ?? 0) * seats;
  return Math.min(due, amountCents);
}

/**
 * Prix d'une réservation : la somme des tarifs (un par place) et des options, avec son détail et
 * l'acompte éventuel. Refuse un tarif ou une option inconnus, ou une quantité au-delà du maximum.
 */
export function quoteBooking(
  event: Priced,
  seats: number,
  selection: PriceSelection = {},
): { lines: PriceLine[]; amountCents: number; depositCents: number | null } {
  if (event.paymentMode === "free") return { lines: [], amountCents: 0, depositCents: null };
  const pricing = event.modules.pricing;
  const rates = ratesOf(event);
  const fallback = pricing ? defaultRate(pricing) : (rates[0] as Rate);
  const chosen = selection.rates ?? [];
  if (chosen.length > seats) {
    throw new ValidationError("Plus de tarifs que de places", [
      { path: "rates", message: "Plus de tarifs que de places" },
    ]);
  }
  const counts = new Map<string, number>();
  for (let seat = 0; seat < seats; seat++) {
    const id = chosen[seat] ?? fallback.id;
    if (!rates.some((rate) => rate.id === id)) {
      throw new ValidationError("Ce tarif n'existe pas", [
        { path: `rates.${seat}`, message: "Ce tarif n'existe pas" },
      ]);
    }
    counts.set(id, (counts.get(id) ?? 0) + 1);
  }
  const lines: PriceLine[] = rates.flatMap((rate) => {
    const quantity = counts.get(rate.id) ?? 0;
    return quantity > 0
      ? [
          {
            kind: "rate" as const,
            id: rate.id,
            label: rate.name,
            unitCents: rate.priceCents,
            quantity,
            totalCents: rate.priceCents * quantity,
          },
        ]
      : [];
  });

  const options = pricing?.options ?? [];
  for (const [id, quantity] of Object.entries(selection.options ?? {})) {
    const option = options.find((entry) => entry.id === id);
    if (!option) {
      throw new ValidationError("Cette option n'existe pas", [
        { path: `options.${id}`, message: "Cette option n'existe pas" },
      ]);
    }
    if (!Number.isInteger(quantity) || quantity < 0 || quantity > optionMax(option, seats)) {
      throw new ValidationError(`Quantité impossible pour « ${option.name} »`, [
        { path: `options.${id}`, message: `${optionMax(option, seats)} au plus` },
      ]);
    }
  }
  for (const option of options) {
    const quantity = selection.options?.[option.id] ?? 0;
    if (quantity > 0) {
      lines.push({
        kind: "option",
        id: option.id,
        label: option.name,
        unitCents: option.priceCents,
        quantity,
        totalCents: option.priceCents * quantity,
      });
    }
  }

  const amountCents = lines.reduce((total, line) => total + line.totalCents, 0);
  const deposit = event.paymentMode === "deposit" ? event.modules.deposit : undefined;
  return {
    // Sans module ni prix, rien à détailler (événement gratuit hors mode « gratuit »).
    lines: !pricing && amountCents === 0 ? [] : lines,
    amountCents,
    depositCents: deposit ? depositFor(deposit, amountCents, seats) : null,
  };
}

/** Le choix d'une réservation, relu dans son détail (changement de date). */
export function selectionFromLines(lines: readonly PriceLine[]): PriceSelection {
  return {
    rates: lines.flatMap((line) =>
      line.kind === "rate" ? Array.from({ length: line.quantity }, () => line.id) : [],
    ),
    options: Object.fromEntries(
      lines.filter((line) => line.kind === "option").map((line) => [line.id, line.quantity]),
    ),
  };
}

/**
 * Le même choix sur un autre événement du type : un tarif disparu devient le tarif par défaut,
 * une option disparue est retirée, une quantité trop grande ramenée au maximum.
 */
export function selectionFor(
  event: Pick<Event, "priceCents" | "modules">,
  seats: number,
  selection: PriceSelection,
): PriceSelection {
  const rates = ratesOf(event);
  const options = event.modules.pricing?.options ?? [];
  return {
    rates: (selection.rates ?? [])
      .slice(0, seats)
      .filter((id) => rates.some((rate) => rate.id === id)),
    options: Object.fromEntries(
      Object.entries(selection.options ?? {}).flatMap(([id, quantity]) => {
        const option = options.find((entry) => entry.id === id);
        return option ? [[id, Math.min(quantity, optionMax(option, seats))]] : [];
      }),
    ),
  };
}

/** « 1 Plein, 1 Réduit · Cuisson et émaillage × 2 » : le détail en une ligne (e-mails, export, listes). */
export function priceLinesLabel(lines: readonly PriceLine[]): string {
  const rates = lines.filter((line) => line.kind === "rate");
  const options = lines.filter((line) => line.kind === "option");
  return [
    rates.map((line) => `${line.quantity} ${line.label}`).join(", "),
    ...options.map((line) => (line.quantity > 1 ? `${line.label} × ${line.quantity}` : line.label)),
  ]
    .filter(Boolean)
    .join(" · ");
}

/* ---------- Moyens acceptés ---------- */

/** Le type accepte-t-il les bons cadeaux ? Sans module, oui. */
export const acceptsGiftCards = (methods: PaymentMethodsModule | undefined) =>
  methods?.giftCards !== false;

/** Le type accepte-t-il cette carte (sa formule) ? Sans module, toutes. */
export function acceptsPass(
  methods: PaymentMethodsModule | undefined,
  pass: { planId: string | null },
): boolean {
  if (methods?.passes === false) return false;
  if (!methods?.passPlanIds) return true;
  return pass.planId !== null && methods.passPlanIds.includes(pass.planId);
}

/** Séances débitées sur une carte pour `seats` places. */
export const passSessionsFor = (methods: PaymentMethodsModule | undefined, seats: number) =>
  seats * (methods?.sessionsPerSeat ?? 1);
