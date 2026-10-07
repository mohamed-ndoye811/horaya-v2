// Les valeurs viennent du core : une seule source de vérité pour les statuts métier.
import {
  ACTOR_TYPES,
  ALLOCATION_KINDS,
  BOOKING_KINDS,
  BOOKING_PAYMENT_STATUSES,
  BOOKING_SOURCES,
  BOOKING_STATUSES,
  CALENDAR_LINK_FILTERS,
  EVENT_STATUSES,
  EVENT_VISIBILITIES,
  ITEM_UNIT_STATUSES,
  PAYMENT_KINDS,
  PAYMENT_MODES,
  PAYMENT_RECORD_STATUSES,
  STRIPE_ACCOUNT_STATUSES,
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
export const itemUnitStatus = pgEnum("item_unit_status", ITEM_UNIT_STATUSES);
export const allocationKind = pgEnum("allocation_kind", ALLOCATION_KINDS);
export const actorType = pgEnum("actor_type", ACTOR_TYPES);
export const calendarLinkFilter = pgEnum("calendar_link_filter", CALENDAR_LINK_FILTERS);
