export const EVENT_STATUSES = ["draft", "published", "cancelled"] as const;
export type EventStatus = (typeof EVENT_STATUSES)[number];

export const EVENT_VISIBILITIES = ["public", "invite_only"] as const;
export type EventVisibility = (typeof EVENT_VISIBILITIES)[number];

export const PAYMENT_MODES = ["free", "online", "deposit", "on_site"] as const;
export type PaymentMode = (typeof PAYMENT_MODES)[number];
