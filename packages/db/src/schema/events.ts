import type {
  BookingNoun,
  EventModules,
  EventTypeField,
  FieldValues,
  Rule,
  SeriesKind,
} from "@horaya/core";
import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";
import { cents, createdAt, currency, id, organizationId, updatedAt } from "./_columns";
import { member } from "./auth";
import { calendarLinkFilter, eventStatus, eventVisibility, paymentMode } from "./enums";

export const eventType = pgTable(
  "event_type",
  {
    id: id(),
    organizationId: organizationId(),
    name: text().notNull(),
    color: text().notNull(),
    description: text(),
    defaultDurationMinutes: integer(),
    defaultPriceCents: cents(),
    /** « Fonctionnement » (lot 34) : une clé par module actif, validée par le core. */
    modules: jsonb().$type<EventModules>().notNull().default({}),
    /** « Ce que tu décris » et « Ce que tu demandes » (lot 33). */
    fields: jsonb().$type<EventTypeField[]>().notNull().default([]),
    /** Règles « si… alors… » (lot 36). */
    rules: jsonb().$type<Rule[]>().notNull().default([]),
    /** « inscription », « réservation »… sur la page publique et le bouton du formulaire. */
    bookingNoun: text().$type<BookingNoun>().notNull().default("reservation"),
    archivedAt: timestamp({ withTimezone: true }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [unique().on(t.organizationId, t.name)],
);

/** Série récurrente : la règle vit ici, chaque occurrence est un vrai `event`. */
export const eventSeries = pgTable("event_series", {
  id: id(),
  organizationId: organizationId(),
  /** Règle iCalendar, ex. FREQ=MONTHLY;INTERVAL=2 */
  rrule: text().notNull(),
  until: timestamp({ withTimezone: true }),
  timezone: text().notNull(),
  /** `stage` : plusieurs séances, une inscription (lot 37) ; `recurrence` : série récurrente. */
  kind: text().$type<SeriesKind>().notNull().default("recurrence"),
  /** Cours à l'année : inscription à toute la série, au prix de la série. */
  enrollmentEnabled: boolean().notNull().default(false),
  enrollmentPriceCents: cents(),
  /** Stage : prix de chaque tarif pour tout le stage (`rate.id` → centimes). */
  enrollmentPrices: jsonb().$type<Record<string, number>>(),
  /** Stage : le même matériel est réservé à l'élève sur toutes les séances. */
  sameEquipment: boolean().notNull().default(false),
  /** La réservation à la séance reste ouverte au public. */
  dropInAllowed: boolean().notNull().default(true),
  /** Inscription en cours de route au prorata des séances restantes. */
  enrollmentProrata: boolean().notNull().default(true),
  /** Une absence signalée à temps donne une séance à rattraper. */
  makeupAllowed: boolean().notNull().default(true),
  createdAt: createdAt(),
});

export const event = pgTable(
  "event",
  {
    id: id(),
    organizationId: organizationId(),
    eventTypeId: uuid()
      .notNull()
      .references(() => eventType.id, { onDelete: "restrict" }),
    seriesId: uuid().references(() => eventSeries.id, { onDelete: "set null" }),
    title: text().notNull(),
    slug: text().notNull(),
    description: text().notNull().default(""),
    status: eventStatus().notNull().default("draft"),
    visibility: eventVisibility().notNull().default("public"),
    startsAt: timestamp({ withTimezone: true }).notNull(),
    endsAt: timestamp({ withTimezone: true }).notNull(),
    timezone: text().notNull(),
    locationName: text(),
    locationAddress: text(),
    onlineUrl: text(),
    /** null = places illimitées. */
    capacity: integer(),
    priceCents: cents().notNull().default(0),
    currency: currency(),
    paymentMode: paymentMode().notNull().default("free"),
    requiresApproval: boolean().notNull().default(false),
    /** Mentions affichées sur la page publique (« Déjeuner inclus »…). */
    highlights: text().array().notNull().default(sql`'{}'::text[]`),
    /** Lien de paiement externe propre à l'événement (sinon celui de l'espace). */
    paymentLinkUrl: text(),
    coverImageUrl: text(),
    /** Champs du type copiés à la création : l'événement garde sa version. */
    fields: jsonb().$type<EventTypeField[]>().notNull().default([]),
    /** Modules du type copiés à la création (lot 34) ; tarifs et acompte de l'événement (lot 35). */
    modules: jsonb().$type<EventModules>().notNull().default({}),
    /** Règles du type copiées à la création (lot 36). */
    rules: jsonb().$type<Rule[]>().notNull().default([]),
    /** Valeurs de « Ce que tu décris ». */
    fieldValues: jsonb().$type<FieldValues>().notNull().default({}),
    /** Module Intervenant : le membre de l'équipe qui anime l'événement. */
    staffMemberId: uuid().references(() => member.id, { onDelete: "set null" }),
    /** Module Créneaux : événement créé par la réservation d'un créneau (lot 37). */
    fromSlot: boolean().notNull().default(false),
    /** Module Plusieurs séances : le sujet de cette séance du stage. */
    sessionTopic: text(),
    publishedAt: timestamp({ withTimezone: true }),
    cancelledAt: timestamp({ withTimezone: true }),
    /** Rappel de la veille envoyé à l'équipe (une seule fois). */
    reminderSentAt: timestamp({ withTimezone: true }),
    /** Équipe prévenue que l'événement est presque complet (une seule fois). */
    almostFullNotifiedAt: timestamp({ withTimezone: true }),
    /** Seuil de maintien : équipe prévenue du risque d'annulation, la veille de J-x. */
    minimumWarnedAt: timestamp({ withTimezone: true }),
    /** Seuil de maintien : décision prise à J-x (maintenu ou annulé), une seule fois. */
    minimumDecidedAt: timestamp({ withTimezone: true }),
    /** Module Messages : message après la séance envoyé (une seule fois). */
    followUpSentAt: timestamp({ withTimezone: true }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    unique().on(t.organizationId, t.slug),
    index().on(t.organizationId, t.startsAt),
    index().on(t.organizationId, t.status),
    index().on(t.seriesId),
    index().on(t.staffMemberId),
    index().on(t.eventTypeId, t.startsAt).where(sql`${t.fromSlot}`),
    check("event_period_valid", sql`${t.endsAt} > ${t.startsAt}`),
    check("event_capacity_positive", sql`${t.capacity} IS NULL OR ${t.capacity} > 0`),
    check("event_price_positive", sql`${t.priceCents} >= 0`),
  ],
);

export const eventMedia = pgTable(
  "event_media",
  {
    id: id(),
    eventId: uuid()
      .notNull()
      .references(() => event.id, { onDelete: "cascade" }),
    url: text().notNull(),
    alt: text(),
    position: integer().notNull().default(0),
    createdAt: createdAt(),
  },
  (t) => [index().on(t.eventId, t.position)],
);

/**
 * Lien calendrier : page publique qui ne montre qu'une partie des événements
 * (tous, certains types, ou une liste). Il vaut invitation pour les événements
 * « sur invitation » qu'il contient.
 */
export const calendarLink = pgTable(
  "calendar_link",
  {
    id: id(),
    organizationId: organizationId(),
    name: text().notNull(),
    slug: text().notNull(),
    filterMode: calendarLinkFilter().notNull(),
    /** Types d'événements ou événements retenus, selon le mode (vide pour « tous »). */
    filterIds: uuid().array().notNull().default(sql`'{}'::uuid[]`),
    isActive: boolean().notNull().default(true),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [unique().on(t.organizationId, t.slug)],
);

/**
 * Créneau gardé 10 minutes pendant que l'élève remplit le formulaire (module Créneaux,
 * lot 37). Expiré, il ne compte plus ; il est supprimé à la réservation ou au nettoyage.
 */
export const slotHold = pgTable(
  "slot_hold",
  {
    id: id(),
    organizationId: organizationId(),
    eventTypeId: uuid()
      .notNull()
      .references(() => eventType.id, { onDelete: "cascade" }),
    startsAt: timestamp({ withTimezone: true }).notNull(),
    endsAt: timestamp({ withTimezone: true }).notNull(),
    durationId: text(),
    staffMemberId: uuid().references(() => member.id, { onDelete: "cascade" }),
    /** Créneau déjà réservé que l'élève vient compléter. */
    eventId: uuid().references(() => event.id, { onDelete: "cascade" }),
    seats: integer().notNull().default(1),
    expiresAt: timestamp({ withTimezone: true }).notNull(),
    createdAt: createdAt(),
  },
  (t) => [
    index().on(t.organizationId, t.expiresAt),
    check("slot_hold_period_valid", sql`${t.endsAt} > ${t.startsAt}`),
  ],
);
