import { ConflictError, ValidationError } from "../shared/errors";
import type { Event, EventDetails } from "./model";

type Issue = { path: string; message: string };

/** Cohérence d'un événement : période, prix et mode de paiement. */
export function assertEventConsistency(
  event: Pick<
    EventDetails,
    "startsAt" | "endsAt" | "priceCents" | "paymentMode" | "depositPercent"
  >,
): void {
  const issues: Issue[] = [];
  if (event.endsAt <= event.startsAt) {
    issues.push({ path: "endsAt", message: "La fin doit être après le début" });
  }
  if (event.paymentMode === "free" && event.priceCents !== 0) {
    issues.push({ path: "priceCents", message: "Un événement gratuit n'a pas de prix" });
  }
  if (event.paymentMode !== "free" && event.priceCents === 0) {
    issues.push({ path: "priceCents", message: "Indique un prix ou choisis « gratuit »" });
  }
  if (event.paymentMode === "deposit" && event.depositPercent === null) {
    issues.push({ path: "depositPercent", message: "Indique le pourcentage d'acompte" });
  }
  if (event.paymentMode !== "deposit" && event.depositPercent !== null) {
    issues.push({ path: "depositPercent", message: "L'acompte ne s'applique qu'au mode acompte" });
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
