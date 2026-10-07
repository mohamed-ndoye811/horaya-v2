import type { BookingRules } from "@horaya/core";

export type AvailabilityTone = "success" | "warning" | "info";

/** Places restantes d'un événement, telles qu'affichées sur la page publique (écrans 27 et 10). */
export function availability(capacity: number | null, seatsHeld: number) {
  if (capacity === null) {
    return {
      remaining: null,
      full: false,
      ratio: null,
      label: "Places illimitées",
      tone: "success" as AvailabilityTone,
    };
  }
  const remaining = Math.max(0, capacity - seatsHeld);
  const ratio = Math.min(1, seatsHeld / capacity);
  if (remaining === 0)
    return { remaining, full: true, ratio: 1, label: "Complet", tone: "info" as AvailabilityTone };
  // Dernier tiers : on prévient qu'il faut se dépêcher.
  const scarce = remaining * 3 <= capacity;
  return {
    remaining,
    full: false,
    ratio,
    label: scarce
      ? `Plus que ${remaining} place${remaining > 1 ? "s" : ""}`
      : `${remaining} place${remaining > 1 ? "s" : ""} restante${remaining > 1 ? "s" : ""}`,
    tone: (scarce ? "warning" : "success") as AvailabilityTone,
  };
}

export type BookingState =
  | { kind: "open"; maxSeats: number }
  | { kind: "waitlist"; maxSeats: number }
  | { kind: "full" }
  | { kind: "closed" };

/** Peut-on réserver en ligne, et combien de places au plus ? */
export function bookingState(
  event: { startsAt: Date; capacity: number | null; seatsHeld: number; bookingRules: BookingRules },
  now: Date,
): BookingState {
  const closesAt = event.startsAt.getTime() - (event.bookingRules.minAdvanceHours ?? 0) * 3_600_000;
  if (now.getTime() >= closesAt) return { kind: "closed" };
  const perBooking = event.bookingRules.maxSeatsPerBooking ?? 20;
  const { remaining } = availability(event.capacity, event.seatsHeld);
  if (remaining === 0) {
    return event.bookingRules.waitlistEnabled
      ? { kind: "waitlist", maxSeats: perBooking }
      : { kind: "full" };
  }
  return {
    kind: "open",
    maxSeats: remaining === null ? perBooking : Math.min(perBooking, remaining),
  };
}

const FREQUENCIES: Record<string, [string, string]> = {
  DAILY: ["Tous les jours", "jours"],
  WEEKLY: ["Toutes les semaines", "semaines"],
  MONTHLY: ["Tous les mois", "mois"],
};

/** « FREQ=MONTHLY;INTERVAL=2 » → « Tous les 2 mois ». */
export function describeRecurrence(rrule: string | null): string | null {
  if (!rrule) return null;
  const parts = Object.fromEntries(
    rrule.split(";").map((part) => part.split("=") as [string, string]),
  );
  const frequency = FREQUENCIES[parts.FREQ ?? ""];
  if (!frequency) return null;
  const interval = Number(parts.INTERVAL ?? 1);
  return interval > 1
    ? `${parts.FREQ === "WEEKLY" ? "Toutes" : "Tous"} les ${interval} ${frequency[1]}`
    : frequency[0];
}

/** « Annulation gratuite jusqu'au 12 juin. Ensuite, 50 % sont remboursés. » */
export function cancellationPolicy(
  startsAt: Date,
  policy: { freeCancellationHours: number; lateCancellationRefundPercent: number },
  timeZone: string,
  now = new Date(),
): string {
  const late =
    policy.lateCancellationRefundPercent === 0
      ? "aucun remboursement"
      : `${policy.lateCancellationRefundPercent} % remboursés`;
  if (policy.freeCancellationHours === 0) return `Annulation possible jusqu'au début, ${late}.`;
  const deadline = new Date(startsAt.getTime() - policy.freeCancellationHours * 3_600_000);
  if (now > deadline) return `Délai d'annulation gratuite passé : ${late}.`;
  const day = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "long", timeZone }).format(
    deadline,
  );
  return `Annulation gratuite jusqu'au ${day}. Ensuite, ${late}.`;
}

/** « Séminaire » → « Séminaires » (filtres de la page publique). */
export const pluralize = (word: string) => (/[sxz]$/i.test(word) ? word : `${word}s`);

/** Conditions de paiement affichées sur la page publique. */
export function paymentNote(
  paymentMode: string,
  onlinePayments: boolean,
  depositPercent: number | null,
): string {
  if (paymentMode === "free") return "Gratuit";
  if (paymentMode === "on_site") return "Paiement sur place";
  if (!onlinePayments) return "Paiement auprès de l'organisateur";
  return paymentMode === "deposit"
    ? `Acompte de ${depositPercent ?? 0} % par carte, le reste sur place`
    : "Paiement sécurisé par carte";
}
