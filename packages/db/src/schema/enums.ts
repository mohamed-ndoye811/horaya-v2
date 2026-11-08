// Les valeurs viennent du core : une seule source de vérité pour les statuts métier.
import {
  ACTOR_TYPES,
  ALLOCATION_KINDS,
  BILLING_INTERVALS,
  BILLING_RATES,
  BOOKING_KINDS,
  BOOKING_PAYMENT_STATUSES,
  BOOKING_SOURCES,
  BOOKING_STATUSES,
  CALENDAR_LINK_FILTERS,
  EVENT_STATUSES,
  EVENT_VISIBILITIES,
  GIFT_CARD_MOVEMENT_KINDS,
  GIFT_CARD_SOURCES,
  GIFT_CARD_STATUSES,
  ITEM_UNIT_STATUSES,
  PASS_MOVEMENT_KINDS,
  PASS_STATUSES,
  PAYMENT_KINDS,
  PAYMENT_METHODS,
  PAYMENT_MODES,
  PAYMENT_RECORD_STATUSES,
  PLAN_GRANT_KINDS,
  PLAN_IDS,
  STRIPE_ACCOUNT_STATUSES,
  SUBSCRIPTION_STATUSES,
} from "@horaya/core";
import { pgEnum } from "drizzle-orm/pg-core";

export const stripeAccountStatus = pgEnum("stripe_account_status", STRIPE_ACCOUNT_STATUSES);
export const eventStatus = pgEnum("event_status", EVENT_STATUSES);
export const eventVisibility = pgEnum("event_visibility", EVENT_VISIBILITIES);
export const paymentMode = pgEnum("payment_mode", PAYMENT_MODES);
export const bookingKind = pgEnum("booking_kind", BOOKING_KINDS);
export const bookingStatus = pgEnum("booking_status", BOOKING_STATUSES);
export const bookingPaymentStatus = pgEnum("booking_payment_status", BOOKING_PAYMENT_STATUSES);
export const bookingSource = pgEnum("booking_source", BOOKING_SOURCES);
export const paymentKind = pgEnum("payment_kind", PAYMENT_KINDS);
export const paymentRecordStatus = pgEnum("payment_record_status", PAYMENT_RECORD_STATUSES);
export const paymentMethod = pgEnum("payment_method", PAYMENT_METHODS);
export const itemUnitStatus = pgEnum("item_unit_status", ITEM_UNIT_STATUSES);
export const allocationKind = pgEnum("allocation_kind", ALLOCATION_KINDS);
export const actorType = pgEnum("actor_type", ACTOR_TYPES);
export const calendarLinkFilter = pgEnum("calendar_link_filter", CALENDAR_LINK_FILTERS);
export const planId = pgEnum("plan_id", PLAN_IDS);
export const billingInterval = pgEnum("billing_interval", BILLING_INTERVALS);
export const billingRate = pgEnum("billing_rate", BILLING_RATES);
export const planGrantKind = pgEnum("plan_grant_kind", PLAN_GRANT_KINDS);
export const subscriptionStatus = pgEnum("subscription_status", SUBSCRIPTION_STATUSES);
export const passStatus = pgEnum("pass_status", PASS_STATUSES);
export const passMovementKind = pgEnum("pass_movement_kind", PASS_MOVEMENT_KINDS);
export const giftCardStatus = pgEnum("gift_card_status", GIFT_CARD_STATUSES);
export const giftCardMovementKind = pgEnum("gift_card_movement_kind", GIFT_CARD_MOVEMENT_KINDS);
export const giftCardSource = pgEnum("gift_card_source", GIFT_CARD_SOURCES);
