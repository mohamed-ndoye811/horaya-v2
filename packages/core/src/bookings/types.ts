export const BOOKING_KINDS = ["event", "rental"] as const;
export type BookingKind = (typeof BOOKING_KINDS)[number];

export const BOOKING_STATUSES = [
  "pending",
  "confirmed",
  "refused",
  "cancelled",
  "waitlisted",
] as const;
export type BookingStatus = (typeof BOOKING_STATUSES)[number];

export const BOOKING_PAYMENT_STATUSES = [
  "none",
  "authorized",
  "paid",
  "partially_refunded",
  "refunded",
  "failed",
] as const;
export type BookingPaymentStatus = (typeof BOOKING_PAYMENT_STATUSES)[number];

export const BOOKING_SOURCES = ["public_page", "admin", "api"] as const;
export type BookingSource = (typeof BOOKING_SOURCES)[number];

export const PAYMENT_KINDS = ["charge", "deposit", "balance", "refund"] as const;
export type PaymentKind = (typeof PAYMENT_KINDS)[number];

export const PAYMENT_RECORD_STATUSES = ["pending", "succeeded", "failed"] as const;
export type PaymentRecordStatus = (typeof PAYMENT_RECORD_STATUSES)[number];
