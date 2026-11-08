import { defaultRate } from "../bookings/pricing";
import type { DepositModule, EventModules, PricingModule } from "../modules/registry";
import { ConflictError, ValidationError } from "../shared/errors";
import type { Event, EventDetails } from "./model";
import type { PaymentMode } from "./types";

type Issue = { path: string; message: string };

/** Nouveaux prix d'un module « Tarifs et options » : les noms et le reste ne changent pas. */
export function withPrices(pricing: PricingModule, prices: Record<string, number>): PricingModule {
  const price = <T extends { id: string; priceCents: number }>(entry: T): T => ({
    ...entry,
    priceCents: prices[entry.id] ?? entry.priceCents,
  });
  return {
    ...pricing,
    rates: pricing.rates.map(price),
    ...(pricing.options && { options: pricing.options.map(price) }),
  };
}

/**
 * L'argent d'un événement (lot 35) : ses tarifs (ceux du type, prix modifiables), son acompte
 * (`deposit` absent : inchangé, null : retiré) et son prix affiché, celui du tarif par défaut.
 */
export function eventMoney(
  base: { modules: EventModules; priceCents: number; paymentMode: PaymentMode },
  input: {
    deposit?: DepositModule | null | undefined;
    prices?: Record<string, number> | undefined;
  },
): { modules: EventModules; priceCents: number } {
  const { pricing: basePricing, deposit: baseDeposit, ...rest } = base.modules;
  const pricing = basePricing && input.prices ? withPrices(basePricing, input.prices) : basePricing;
  const deposit = input.deposit === undefined ? baseDeposit : (input.deposit ?? undefined);
  return {
    modules: { ...rest, ...(pricing && { pricing }), ...(deposit && { deposit }) },
    priceCents:
      base.paymentMode === "free" ? 0 : pricing ? defaultRate(pricing).priceCents : base.priceCents,
  };
}

/** Cohérence d'un événement : période, prix et mode de paiement. */
export function assertEventConsistency(
  event: Pick<EventDetails, "startsAt" | "endsAt" | "priceCents" | "paymentMode"> & {
    modules: EventModules;
  },
): void {
  const issues: Issue[] = [];
  if (event.endsAt <= event.startsAt) {
    issues.push({ path: "endsAt", message: "La fin doit être après le début" });
  }
  if (event.paymentMode === "free" && event.priceCents !== 0) {
    issues.push({ path: "priceCents", message: "Un événement gratuit n'a pas de prix" });
  }
  const pricing = event.modules.pricing;
  const paid = pricing
    ? [...pricing.rates, ...(pricing.options ?? [])].some((entry) => entry.priceCents > 0)
    : event.priceCents > 0;
  if (event.paymentMode !== "free" && !paid) {
    issues.push({
      path: pricing ? "prices" : "priceCents",
      message: "Indique un prix ou choisis « gratuit »",
    });
  }
  if (event.paymentMode === "deposit" && !event.modules.deposit) {
    issues.push({ path: "deposit", message: "Indique l'acompte" });
  }
  if (issues.length > 0) throw new ValidationError("Événement incohérent", issues);
}

export function assertCanPublish(event: Event, now: Date): void {
  if (event.status !== "draft") {
    throw new ConflictError(
      event.status === "published"
        ? "L'événement est déjà publié"
        : "Un événement annulé ne peut pas être publié",
    );
  }
  if (event.startsAt <= now)
    throw new ConflictError("Impossible de publier un événement déjà commencé");
}

export function assertCanEdit(event: Event): void {
  if (event.status === "cancelled")
    throw new ConflictError("Un événement annulé ne peut plus être modifié");
}

export function assertCanCancel(event: Event): void {
  if (event.status === "cancelled") throw new ConflictError("L'événement est déjà annulé");
}

/** On ne réduit jamais la jauge sous les places déjà occupées. */
export function assertCapacityFits(capacity: number | null, seatsHeld: number): void {
  if (capacity !== null && capacity < seatsHeld) {
    throw new ConflictError(
      `${seatsHeld} place${seatsHeld > 1 ? "s sont déjà réservées" : " est déjà réservée"} : la jauge ne peut pas descendre en dessous`,
    );
  }
}
