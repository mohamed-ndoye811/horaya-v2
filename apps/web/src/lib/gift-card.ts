import type { GiftCardMovementKind, GiftCardState } from "@horaya/core";
import type { Tone } from "@/components/ui/badge";

export const GIFT_CARD_STATE: Record<GiftCardState, { label: string; tone: Tone }> = {
  pending: { label: "À payer", tone: "warning" },
  active: { label: "Actif", tone: "success" },
  used: { label: "Épuisé", tone: "draft" },
  expired: { label: "Expiré", tone: "danger" },
  cancelled: { label: "Annulé", tone: "draft" },
};

export const GIFT_CARD_MOVEMENT: Record<
  GiftCardMovementKind,
  { label: string; tone: "ink" | "success" | "warning" | "danger" | "muted" }
> = {
  issue: { label: "Émission du bon", tone: "success" },
  use: { label: "Utilisé", tone: "ink" },
  restore: { label: "Montant rendu au bon", tone: "warning" },
  cancel: { label: "Bon annulé", tone: "danger" },
  adjust: { label: "Ajustement", tone: "muted" },
};

/** « 24 déc. 2027 ». */
export const formatGiftCardDate = (date: Date, timeZone = "Europe/Paris") =>
  new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short", year: "numeric", timeZone })
    .format(date)
    .replace(/ /g, " ");
