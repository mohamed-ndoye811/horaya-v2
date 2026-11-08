import { z } from "zod";

/** Ce dont un membre peut être prévenu, et ses réglages par défaut (écran 26). */
export const NOTIFICATION_TYPES = [
  { value: "booking_created", label: "Nouvelle réservation", email: true, inApp: true },
  { value: "booking_cancelled", label: "Réservation annulée", email: true, inApp: true },
  {
    value: "booking_rescheduled",
    label: "Changement de date avec écart de prix",
    email: true,
    inApp: true,
  },
  { value: "payment_received", label: "Paiement reçu", email: false, inApp: true },
  { value: "gift_card_purchased", label: "Bon cadeau acheté", email: true, inApp: true },
  { value: "event_almost_full", label: "Événement presque complet", email: true, inApp: false },
  { value: "event_reminder", label: "Rappel la veille d'un événement", email: true, inApp: true },
  {
    value: "event_at_risk",
    label: "Risque d'annulation (seuil de maintien)",
    email: true,
    inApp: true,
  },
  {
    value: "event_auto_cancelled",
    label: "Événement annulé faute d'inscrits",
    email: true,
    inApp: true,
  },
  {
    value: "rule_applied",
    label: "Une règle « si… alors… » prévient l'équipe",
    email: true,
    inApp: true,
  },
  { value: "weekly_digest", label: "Récap hebdomadaire", email: true, inApp: false },
] as const;
export type NotificationType = (typeof NOTIFICATION_TYPES)[number]["value"];

export interface NotificationPreference {
  type: NotificationType;
  email: boolean;
  inApp: boolean;
}

/** Préférences d'un membre : celles qu'il a enregistrées, sinon les réglages par défaut. */
export function withDefaultPreferences(
  saved: ReadonlyArray<{ type: string; email: boolean; inApp: boolean }>,
): NotificationPreference[] {
  return NOTIFICATION_TYPES.map(({ value, email, inApp }) => {
    const found = saved.find((preference) => preference.type === value);
    return { type: value, email: found?.email ?? email, inApp: found?.inApp ?? inApp };
  });
}

export const notificationPreferencesSchema = z.array(
  z.object({
    type: z.enum(
      NOTIFICATION_TYPES.map((type) => type.value) as [NotificationType, ...NotificationType[]],
    ),
    email: z.boolean(),
    inApp: z.boolean(),
  }),
);
