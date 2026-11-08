import type { Event } from "../events/model";
import type {
  DepositModule,
  PaymentMethodsModule,
  PriceOption,
  PricingModule,
  Rate,
} from "../modules/registry";
import { durationOf } from "../modules/time";
import { ValidationError } from "../shared/errors";

/**
 * Le prix d'une réservation (lot 35) : une seule fonction pure, `quoteBooking`, pour la page
 * publique, le comptoir, l'espace client, le changement de date, les bons et les cartes.
 * Montants en centimes entiers ; le seul arrondi est celui de l'acompte en pourcentage.
 */

/** Une ligne du détail, enregistrée sur la réservation : l'historique ne bouge plus si le type change. */
export interface PriceLine {
  /** `discount` : réduction d'une règle (lot 36), montant négatif ; `duration` : durée choisie (lot 37). */
  kind: "rate" | "option" | "discount" | "duration";
  /** Identifiant du tarif ou de l'option dans le module « Tarifs et options » (la règle pour une réduction). */
  id: string;
  label: string;
  unitCents: number;
  quantity: number;
  totalCents: number;
  /** Réduction en pourcentage : rejouée telle quelle au changement de date. */
  percent?: number;
}

/**
 * Ajustement décidé par une règle (lot 36) : toutes les places passent à un tarif, ou une
 * réduction s'applique au total (en %, puis en montant, dans l'ordre des règles).
 */
export type PriceAdjustment =
  | { kind: "rate"; id: string; label: string; rateId: string }
  | { kind: "percent"; id: string; label: string; percent: number }
  | { kind: "amount"; id: string; label: string; amountCents: number };

/** Ce que le client choisit : un tarif par place (dans l'ordre des participants), des options. */
export interface PriceSelection {
  /** Tarif de chaque place ; place sans tarif : le tarif par défaut. */
  rates?: readonly string[];
  /** Quantité de chaque option (une option « par participant » : le nombre de participants qui la prennent). */
  options?: Readonly<Record<string, number>>;
  /** Module « Durée au choix » : la durée choisie (absent : celle par défaut). */
  durationId?: string | null;
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
  adjustments: readonly PriceAdjustment[] = [],
): { lines: PriceLine[]; amountCents: number; depositCents: number | null } {
  if (event.paymentMode === "free") return { lines: [], amountCents: 0, depositCents: null };
  const pricing = event.modules.pricing;
  const rates = ratesOf(event);
  const fallback = pricing ? defaultRate(pricing) : (rates[0] as Rate);
  // Passage à un tarif par une règle : le dernier qui existe sur l'événement l'emporte.
  const forced = adjustments.findLast(
    (entry) => entry.kind === "rate" && rates.some((rate) => rate.id === entry.rateId),
  );
  const chosen =
    forced?.kind === "rate"
      ? Array.from({ length: seats }, () => forced.rateId)
      : (selection.rates ?? []);
  if (chosen.length > seats) {
    throw new ValidationError("Plus de tarifs que de places", [
      { path: "rates", message: "Plus de tarifs que de places" },
    ]);
  }
  // Durée au choix : la durée fixe le prix de chaque place, les tarifs ne s'appliquent pas.
  const duration = event.modules.duration
    ? durationOf(event.modules.duration, selection.durationId)
    : null;
  const counts = new Map<string, number>();
  for (let seat = 0; seat < (duration ? 0 : seats); seat++) {
    const id = chosen[seat] ?? fallback.id;
    if (!rates.some((rate) => rate.id === id)) {
      throw new ValidationError("Ce tarif n'existe pas", [
        { path: `rates.${seat}`, message: "Ce tarif n'existe pas" },
      ]);
    }
    counts.set(id, (counts.get(id) ?? 0) + 1);
  }
  const lines: PriceLine[] = duration
    ? [
        {
          kind: "duration",
          id: duration.id,
          label: duration.label,
          unitCents: duration.priceCents,
          quantity: seats,
          totalCents: duration.priceCents * seats,
        },
      ]
    : rates.flatMap((rate) => {
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

  // Réductions des règles : sur ce qui reste à payer, jamais en dessous de zéro.
  const subtotal = lines.reduce((total, line) => total + line.totalCents, 0);
  let remaining = subtotal;
  for (const adjustment of adjustments) {
    if (adjustment.kind === "rate") continue;
    const off =
      adjustment.kind === "percent"
        ? Math.round((remaining * adjustment.percent) / 100)
        : Math.min(adjustment.amountCents, remaining);
    if (off <= 0) continue;
    remaining -= off;
    lines.push({
      kind: "discount",
      id: adjustment.id,
      label: adjustment.label,
      unitCents: -off,
      quantity: 1,
      totalCents: -off,
      ...(adjustment.kind === "percent" && { percent: adjustment.percent }),
    });
  }

  const amountCents = remaining;
  const deposit = event.paymentMode === "deposit" ? event.modules.deposit : undefined;
  return {
    // Sans module ni prix, rien à détailler (événement gratuit hors mode « gratuit »).
    lines: !pricing && subtotal === 0 ? [] : lines,
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
    durationId: lines.find((line) => line.kind === "duration")?.id,
  };
}

/** Les réductions d'une réservation, relues dans son détail (changement de date). */
export function adjustmentsFromLines(lines: readonly PriceLine[]): PriceAdjustment[] {
  return lines.flatMap((line): PriceAdjustment[] =>
    line.kind !== "discount"
      ? []
      : line.percent !== undefined
        ? [{ kind: "percent", id: line.id, label: line.label, percent: line.percent }]
        : [{ kind: "amount", id: line.id, label: line.label, amountCents: -line.unitCents }],
  );
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
    durationId: event.modules.duration?.options.some((option) => option.id === selection.durationId)
      ? selection.durationId
      : undefined,
  };
}

/** « 1 Plein, 1 Réduit · Cuisson et émaillage × 2 » : le détail en une ligne (e-mails, export, listes). */
export function priceLinesLabel(lines: readonly PriceLine[]): string {
  const rates = lines.filter((line) => line.kind === "rate");
  const options = lines.filter((line) => line.kind === "option");
  return [
    ...lines
      .filter((line) => line.kind === "duration")
      .map((line) => (line.quantity > 1 ? `${line.label} × ${line.quantity}` : line.label)),
    rates.map((line) => `${line.quantity} ${line.label}`).join(", "),
    ...options.map((line) => (line.quantity > 1 ? `${line.label} × ${line.quantity}` : line.label)),
    ...lines.filter((line) => line.kind === "discount").map((line) => line.label),
  ]
    .filter(Boolean)
    .join(" · ");
}

/** Le détail à montrer au client, ou null s'il n'apprend rien (un seul tarif « Plein », sans option). */
export function priceDetail(lines: readonly PriceLine[]): string | null {
  const only = lines.length === 1 ? lines[0] : undefined;
  if (lines.length === 0 || (only?.kind === "rate" && only.id === BASE_RATE_ID)) return null;
  return priceLinesLabel(lines);
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
