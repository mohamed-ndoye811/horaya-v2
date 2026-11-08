import { BASE_RATE_ID, defaultRate } from "../bookings/pricing";
import { promoteWaitlist } from "../bookings/waitlist";
import { fieldsOfScope, validateFieldValues } from "../fields/values";
import type { EventModules } from "../modules/registry";
import { eventPlace, restrictEquipment, staffAllowed } from "../modules/resources";
import { minimumState, withModuleFields } from "../modules/rules";
import { durationOf, withChosenDuration } from "../modules/time";
import { recreditPassForBooking } from "../passes/use-cases";
import { assertRulesFit } from "../rules/engine";
import { type Actor, actorRef, assertMemberCan } from "../shared/actor";
import { NotFoundError, ValidationError } from "../shared/errors";
import { toZonedParts } from "../shared/time";
import type { Deps, Repositories } from "../shared/unit-of-work";
import { validate } from "../shared/validate";
import { slugify } from "../tenants/workspace";
import type { Event, EventType } from "./model";
import type { EventPatch, EventTypePatch } from "./ports";
import { generateOccurrences, toRRule } from "./recurrence";
import {
  assertCanCancel,
  assertCanEdit,
  assertCanPublish,
  assertCapacityFits,
  assertEventConsistency,
  eventMoney,
} from "./rules";
import {
  type CreateEventInput,
  type CreateEventTypeInput,
  createEventSchema,
  createEventTypeSchema,
  type UpdateEventInput,
  type UpdateEventTypeInput,
  updateEventSchema,
  updateEventTypeSchema,
} from "./schemas";

/** Le module Matériel avancé ne peut viser qu'une catégorie de matériel de l'espace. */
async function assertEquipmentTypesExist(
  repositories: Repositories,
  organizationId: string,
  modules: EventModules,
) {
  for (const [index, need] of (modules.equipment?.needs ?? []).entries()) {
    if (!(await repositories.inventory.unitsOfItemType(organizationId, need.itemTypeId))) {
      throw new ValidationError("Type de matériel inconnu", [
        {
          path: `modules.equipment.needs.${index}.itemTypeId`,
          message: "Choisis un type de matériel",
        },
      ]);
    }
  }
}

/** Module Intervenant : un membre de l'espace, et proposé pour le type s'il y a une liste. */
async function assertStaffMember(
  repositories: Repositories,
  organizationId: string,
  modules: EventModules,
  memberId: string | null,
) {
  if (memberId === null) return;
  if (
    !(await repositories.events.memberBelongs(organizationId, memberId)) ||
    !staffAllowed(modules.staff, memberId)
  ) {
    throw new ValidationError("Intervenant non proposé pour ce type", [
      { path: "staffMemberId", message: "Choisis un membre proposé pour ce type" },
    ]);
  }
}

export async function createEventType(
  deps: Deps,
  actor: Actor,
  input: CreateEventTypeInput,
): Promise<EventType> {
  assertMemberCan(actor, "event", "create");
  const data = validate(createEventTypeSchema, input);

  const fields = withModuleFields(data.fields, data.modules);
  const pricing = data.modules.pricing;
  assertRulesFit(data.rules, fields, data.modules);

  return deps.uow.run(async (repositories) => {
    await assertEquipmentTypesExist(repositories, actor.organizationId, data.modules);
    const eventType = await repositories.eventTypes.insert({
      organizationId: actor.organizationId,
      ...data,
      fields,
      defaultDurationMinutes: data.defaultDurationMinutes ?? null,
      defaultPriceCents: pricing
        ? defaultRate(pricing).priceCents
        : (data.defaultPriceCents ?? null),
    });
    await repositories.activity.record({
      organizationId: actor.organizationId,
      entityType: "event_type",
      entityId: eventType.id,
      action: "event_type.created",
      ...actorRef(actor),
    });
    return eventType;
  });
}

export async function updateEventType(
  deps: Deps,
  actor: Actor,
  eventTypeId: string,
  input: UpdateEventTypeInput,
): Promise<EventType> {
  assertMemberCan(actor, "event", "update");
  const { applyToUpcoming, ...patch }: { applyToUpcoming?: boolean } & EventTypePatch = validate(
    updateEventTypeSchema,
    input,
  );

  return deps.uow.run(async (repositories) => {
    const existing = await repositories.eventTypes.find(actor.organizationId, eventTypeId);
    if (!existing || existing.archivedAt) throw new NotFoundError("Type d'événement", eventTypeId);
    // Une condition d'âge demande l'âge de chaque participant (question ajoutée au besoin).
    if (patch.fields || patch.modules) {
      patch.fields = withModuleFields(
        patch.fields ?? existing.fields,
        patch.modules ?? existing.modules,
      );
    }
    if (patch.modules) {
      await assertEquipmentTypesExist(repositories, actor.organizationId, patch.modules);
    }
    // Avec « Tarifs et options », le prix par défaut est celui du tarif par défaut.
    const pricing = (patch.modules ?? existing.modules).pricing;
    if (pricing) patch.defaultPriceCents = defaultRate(pricing).priceCents;
    if (patch.fields || patch.rules || patch.modules) {
      assertRulesFit(
        patch.rules ?? existing.rules,
        patch.fields ?? existing.fields,
        patch.modules ?? existing.modules,
      );
    }
    const updated = await repositories.eventTypes.update(actor.organizationId, eventTypeId, patch);
    // Les événements gardent leur version du type ; les passés et ceux qui ont des inscrits, toujours.
    const appliedTo =
      applyToUpcoming && (patch.fields || patch.modules || patch.rules)
        ? await repositories.events.applyTypeConfig(
            actor.organizationId,
            eventTypeId,
            {
              fields: updated.fields,
              modules: updated.modules,
              rules: updated.rules,
              ...(updated.modules.pricing && {
                priceCents: defaultRate(updated.modules.pricing).priceCents,
              }),
            },
            deps.clock.now(),
          )
        : 0;
    await repositories.activity.record({
      organizationId: actor.organizationId,
      entityType: "event_type",
      entityId: eventTypeId,
      action: "event_type.updated",
      ...actorRef(actor),
      data: { fields: Object.keys(patch), ...(appliedTo ? { appliedTo } : {}) },
    });
    return updated;
  });
}

/**
 * « Supprimer le type » : on l'archive. Les événements existants le gardent (historique,
 * couleurs) ; il n'est simplement plus proposé à la création.
 */
export async function archiveEventType(
  deps: Deps,
  actor: Actor,
  eventTypeId: string,
): Promise<EventType> {
  assertMemberCan(actor, "event", "delete");

  return deps.uow.run(async (repositories) => {
    const existing = await repositories.eventTypes.find(actor.organizationId, eventTypeId);
    if (!existing || existing.archivedAt) throw new NotFoundError("Type d'événement", eventTypeId);
    const archived = await repositories.eventTypes.update(actor.organizationId, eventTypeId, {
      archivedAt: deps.clock.now(),
    });
    await repositories.activity.record({
      organizationId: actor.organizationId,
      entityType: "event_type",
      entityId: eventTypeId,
      action: "event_type.archived",
      ...actorRef(actor),
    });
    return archived;
  });
}

/** Pages publiques d'un espace dont l'adresse ne peut pas servir à un événement. */
const RESERVED_EVENT_SLUGS: ReadonlySet<string> = new Set([
  "calendrier",
  "creneaux",
  "mentions-legales",
  "mes-reservations",
  "reservation",
]);

/** Adresse unique dans l'espace : « seminaire-annuel », puis « seminaire-annuel-2 »… */
export async function uniqueSlug(repositories: Repositories, organizationId: string, base: string) {
  const root = base || "evenement";
  for (let attempt = 1; attempt <= 50; attempt++) {
    const slug = attempt === 1 ? root : `${root}-${attempt}`;
    if (RESERVED_EVENT_SLUGS.has(slug)) continue;
    if (!(await repositories.events.slugExists(organizationId, slug))) return slug;
  }
  return `${root}-${Date.now().toString(36)}`;
}

type StageSession = { startsAt: Date; endsAt: Date; topic: string | null };

function localDate(date: Date, timeZone: string): string {
  const { year, month, day } = toZonedParts(date, timeZone);
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/**
 * Crée un événement en brouillon, ou toute une série : chaque occurrence devient
 * un événement à part entière (sa propre jauge, ses propres réservations).
 */
export async function createEvent(
  deps: Deps,
  actor: Actor,
  input: CreateEventInput,
): Promise<Event[]> {
  assertMemberCan(actor, "event", "create");
  const {
    eventTypeId,
    recurrence,
    requiresApproval,
    equipmentUnits,
    deposit,
    prices: inputPrices,
    durationId,
    sessions: inputSessions,
    singleSession,
    sameEquipment,
    ...input0
  } = validate(createEventSchema, input);
  // Stage : les séances, dans l'ordre ; le premier début et la première fin servent de repère.
  const sessions = inputSessions
    ? [...inputSessions].sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime())
    : null;
  const fromInput = sessions
    ? {
        ...input0,
        startsAt: (sessions[0] as StageSession).startsAt,
        endsAt: (sessions[0] as StageSession).endsAt,
      }
    : input0;

  const starts = sessions
    ? sessions.map((session) => session.startsAt)
    : recurrence
      ? generateOccurrences(recurrence, fromInput.startsAt, fromInput.timezone)
      : [fromInput.startsAt];

  return deps.uow.run(async (repositories) => {
    const eventType = await repositories.eventTypes.find(actor.organizationId, eventTypeId);
    if (!eventType || eventType.archivedAt)
      throw new NotFoundError("Type d'événement", eventTypeId);
    if (sessions && !eventType.modules.sessions) {
      throw new ValidationError("Ce type n'a pas le module Plusieurs séances", [
        { path: "sessions", message: "Ajoute le module Plusieurs séances au type" },
      ]);
    }
    // Durée au choix : l'événement prend la durée choisie (sa fin, son prix).
    const chosen =
      eventType.modules.duration && !sessions
        ? durationOf(eventType.modules.duration, durationId)
        : null;
    if (chosen) {
      fromInput.endsAt = new Date(fromInput.startsAt.getTime() + chosen.minutes * 60_000);
      if (fromInput.paymentMode !== "free") fromInput.priceCents = chosen.priceCents;
    }
    // Stage : les prix saisis sont ceux de tout le stage ; chaque séance vaut sa part (à l'euro).
    const stagePrices = sessions
      ? eventType.modules.pricing
        ? Object.fromEntries(
            eventType.modules.pricing.rates.map((rate) => [
              rate.id,
              inputPrices?.[rate.id] ?? rate.priceCents,
            ]),
          )
        : { [BASE_RATE_ID]: fromInput.priceCents }
      : null;
    const share = (cents: number) => Math.round(cents / (sessions?.length ?? 1) / 100) * 100;
    const prices = stagePrices
      ? {
          ...inputPrices,
          ...Object.fromEntries(
            Object.entries(stagePrices).map(([id, cents]) => [id, share(cents)]),
          ),
        }
      : inputPrices;
    // Tarifs et acompte : ceux du type, prix et acompte ajustés sur l'événement.
    const money = eventMoney(
      {
        modules: chosen ? withChosenDuration(eventType.modules, chosen) : eventType.modules,
        priceCents:
          stagePrices && !eventType.modules.pricing
            ? share(fromInput.priceCents)
            : fromInput.priceCents,
        paymentMode: fromInput.paymentMode,
      },
      { deposit, prices },
    );
    const details = {
      ...fromInput,
      priceCents: chosen && fromInput.paymentMode !== "free" ? chosen.priceCents : money.priceCents,
    };
    assertEventConsistency({ ...details, modules: money.modules });
    const settings = await repositories.settings.get(actor.organizationId);
    const fieldValues = validateFieldValues(
      fieldsOfScope(eventType.fields, "event"),
      details.fieldValues,
      { now: deps.clock.now() },
      "fieldValues",
    );

    // Module « Inscription à la série » : les nouvelles séries du type partent avec son réglage.
    const preset = eventType.modules.series;
    const stage = eventType.modules.sessions;
    const series = sessions
      ? await repositories.events.insertSeries({
          organizationId: actor.organizationId,
          kind: "stage",
          rrule: "",
          until: (sessions.at(-1) as StageSession).startsAt,
          timezone: details.timezone,
          enrollmentEnabled: true,
          enrollmentPriceCents:
            details.paymentMode === "free"
              ? 0
              : eventType.modules.pricing
                ? ((stagePrices ?? {})[defaultRate(eventType.modules.pricing).id] ?? 0)
                : fromInput.priceCents,
          enrollmentPrices: details.paymentMode === "free" ? null : stagePrices,
          dropInAllowed: singleSession ?? stage?.singleSession ?? false,
          enrollmentProrata: false,
          makeupAllowed: false,
          sameEquipment: sameEquipment ?? stage?.sameEquipment ?? false,
        })
      : recurrence
        ? await repositories.events.insertSeries({
            organizationId: actor.organizationId,
            rrule: toRRule(recurrence),
            until: starts.at(-1) ?? null,
            timezone: details.timezone,
            ...(preset && {
              enrollmentEnabled: true,
              enrollmentPriceCents: preset.priceCents ?? details.priceCents * starts.length,
              dropInAllowed: preset.dropInAllowed ?? true,
              enrollmentProrata: preset.prorata ?? true,
              makeupAllowed: preset.makeupAllowed ?? true,
            }),
          })
        : null;
    await assertStaffMember(
      repositories,
      actor.organizationId,
      eventType.modules,
      details.staffMemberId,
    );
    // Module Lieu : adresse de l'espace ou lien de visio du type, sauf ce que l'équipe a saisi.
    const place = eventPlace(eventType.modules.location, details, settings.address ?? null);
    const modules = equipmentUnits
      ? restrictEquipment(money.modules, equipmentUnits)
      : money.modules;
    // Module « Conditions d'accès » sur invitation : jamais d'événement public de ce type.
    const visibility =
      eventType.modules.access?.inviteOnly && details.visibility === "public"
        ? "invite_only"
        : details.visibility;

    const duration = details.endsAt.getTime() - details.startsAt.getTime();
    const created: Event[] = [];
    for (const [index, startsAt] of starts.entries()) {
      const session = sessions?.[index];
      const base = slugify(details.title);
      const slug = await uniqueSlug(
        repositories,
        actor.organizationId,
        series ? `${base}-${localDate(startsAt, details.timezone)}` : base,
      );
      const event = await repositories.events.insert({
        organizationId: actor.organizationId,
        eventTypeId,
        seriesId: series?.id ?? null,
        slug,
        ...details,
        ...place,
        visibility,
        startsAt,
        endsAt: session?.endsAt ?? new Date(startsAt.getTime() + duration),
        sessionTopic: session?.topic ?? null,
        currency: settings.currency,
        requiresApproval: requiresApproval ?? Boolean(eventType.modules.approval),
        fields: eventType.fields,
        modules,
        rules: eventType.rules,
        fieldValues,
      });
      await repositories.activity.record({
        organizationId: actor.organizationId,
        entityType: "event",
        entityId: event.id,
        action: "event.created",
        ...actorRef(actor),
        data: series ? { seriesId: series.id } : undefined,
      });
      created.push(event);
    }
    return created;
  });
}

/**
 * Modifie un événement. La jauge ne descend jamais sous les places occupées ;
 * si elle augmente, la liste d'attente monte aussitôt.
 */
export async function updateEvent(
  deps: Deps,
  actor: Actor,
  eventId: string,
  input: UpdateEventInput,
): Promise<Event> {
  assertMemberCan(actor, "event", "update");
  const { fieldValues, equipmentUnits, deposit, prices, ...details } = validate(
    updateEventSchema,
    input,
  );
  const patch: EventPatch = details;

  return deps.uow.run(async (repositories) => {
    const locked = await repositories.events.lockForBooking(actor.organizationId, eventId);
    if (!locked) throw new NotFoundError("Événement", eventId);
    const { event } = locked;
    assertCanEdit(event);
    if (fieldValues) {
      patch.fieldValues = validateFieldValues(
        fieldsOfScope(event.fields, "event"),
        fieldValues,
        { now: deps.clock.now() },
        "fieldValues",
      );
    }

    if (patch.staffMemberId !== undefined) {
      await assertStaffMember(
        repositories,
        actor.organizationId,
        event.modules,
        patch.staffMemberId,
      );
    }
    const money = eventMoney(
      {
        modules: event.modules,
        priceCents: patch.priceCents ?? event.priceCents,
        paymentMode: patch.paymentMode ?? event.paymentMode,
      },
      { deposit, prices },
    );
    if (deposit !== undefined || prices) patch.modules = money.modules;
    if (money.priceCents !== event.priceCents || "priceCents" in patch)
      patch.priceCents = money.priceCents;
    if (equipmentUnits) {
      patch.modules = restrictEquipment(patch.modules ?? event.modules, equipmentUnits);
    }
    const merged = { ...event, ...patch };
    assertEventConsistency(merged);

    const capacityChanged = "capacity" in patch && patch.capacity !== event.capacity;
    if (capacityChanged) {
      assertCapacityFits(merged.capacity, await repositories.bookings.seatsHeld(event.id));
    }

    const updated = await repositories.events.update(actor.organizationId, eventId, patch);
    // Le matériel réservé suit l'événement sur ses nouvelles dates (refus si indisponible).
    if (patch.startsAt || patch.endsAt) {
      await repositories.inventory.moveEventAllocations(actor.organizationId, eventId, {
        startsAt: updated.startsAt,
        endsAt: updated.endsAt,
      });
    }
    await repositories.activity.record({
      organizationId: actor.organizationId,
      entityType: "event",
      entityId: eventId,
      action: "event.updated",
      ...actorRef(actor),
      data: { fields: Object.keys(patch) },
    });
    if (capacityChanged) await promoteWaitlist(repositories, updated, actor, deps.clock.now());
    return updated;
  });
}

export async function publishEvent(deps: Deps, actor: Actor, eventId: string): Promise<Event> {
  assertMemberCan(actor, "event", "publish");

  return deps.uow.run(async (repositories) => {
    const locked = await repositories.events.lockForBooking(actor.organizationId, eventId);
    if (!locked) throw new NotFoundError("Événement", eventId);
    const now = deps.clock.now();
    assertCanPublish(locked.event, now);

    const published = await repositories.events.update(actor.organizationId, eventId, {
      status: "published",
      publishedAt: now,
    });
    await repositories.activity.record({
      organizationId: actor.organizationId,
      entityType: "event",
      entityId: eventId,
      action: "event.published",
      ...actorRef(actor),
    });
    return published;
  });
}

/** Image de couverture de l'événement (`null` pour la retirer). Renvoie l'ancienne adresse. */
export async function setEventCover(
  deps: Deps,
  actor: Actor,
  eventId: string,
  coverImageUrl: string | null,
): Promise<string | null> {
  assertMemberCan(actor, "event", "update");
  return deps.uow.run(async (repositories) => {
    const existing = await repositories.events.find(actor.organizationId, eventId);
    if (!existing) throw new NotFoundError("Événement", eventId);
    await repositories.events.update(actor.organizationId, eventId, { coverImageUrl });
    await repositories.activity.record({
      organizationId: actor.organizationId,
      entityType: "event",
      entityId: eventId,
      action: "event.updated",
      ...actorRef(actor),
      data: { fields: ["coverImageUrl"] },
    });
    return existing.coverImageUrl;
  });
}

/**
 * Annule un événement et toutes ses réservations actives (sous le verrou de l'événement) :
 * le matériel est libéré, les séances des cartes sont toujours rendues, chaque inscrit est
 * prévenu par l'e-mail d'annulation (journal `booking.cancelled`).
 */
export async function cancelLockedEvent(
  repositories: Repositories,
  actor: Actor,
  locked: Event,
  now: Date,
  reason: string | null,
): Promise<{ event: Event; cancelledBookings: number }> {
  assertCanCancel(locked);
  const event = await repositories.events.update(actor.organizationId, locked.id, {
    status: "cancelled",
    cancelledAt: now,
  });
  await repositories.inventory.cancelAllocations(actor.organizationId, { eventId: locked.id }, now);
  const active = await repositories.bookings.listActive(locked.id);
  const bookingReason =
    reason === "minimum_not_reached" || reason === "stage_cancelled" ? reason : "event_cancelled";
  for (const booking of active) {
    await repositories.bookings.updateStatus(actor.organizationId, booking.id, {
      status: "cancelled",
      cancelledAt: now,
    });
    await repositories.activity.record({
      organizationId: actor.organizationId,
      entityType: "booking",
      entityId: booking.id,
      action: "booking.cancelled",
      ...actorRef(actor),
      data: { reason: bookingReason },
    });
    // L'atelier annule tout l'événement : les séances des cartes sont toujours rendues.
    await recreditPassForBooking(repositories, actor, booking, locked.startsAt, now, "always");
  }
  await repositories.activity.record({
    organizationId: actor.organizationId,
    entityType: "event",
    entityId: locked.id,
    action: "event.cancelled",
    ...actorRef(actor),
    data: { reason, cancelledBookings: active.length },
  });
  return { event, cancelledBookings: active.length };
}

/** Annule un événement et toutes ses réservations actives. */
export async function cancelEvent(
  deps: Deps,
  actor: Actor,
  eventId: string,
  reason?: string,
): Promise<{ event: Event; cancelledBookings: number }> {
  assertMemberCan(actor, "event", "delete");

  return deps.uow.run(async (repositories) => {
    const locked = await repositories.events.lockForBooking(actor.organizationId, eventId);
    if (!locked) throw new NotFoundError("Événement", eventId);
    return cancelLockedEvent(repositories, actor, locked.event, deps.clock.now(), reason ?? null);
  });
}

/**
 * « Maintenir quand même » : l'équipe retire le seuil de maintien de cet événement (sa copie
 * des modules), la tâche planifiée ne l'annulera pas.
 */
export async function keepEventDespiteMinimum(
  deps: Deps,
  actor: Actor,
  eventId: string,
): Promise<Event> {
  assertMemberCan(actor, "event", "update");
  return deps.uow.run(async (repositories) => {
    const locked = await repositories.events.lockForBooking(actor.organizationId, eventId);
    if (!locked) throw new NotFoundError("Événement", eventId);
    const { places, ...modules } = locked.event.modules;
    if (!places?.minimum) return locked.event;
    const { minimum: _minimum, ...rest } = places;
    const updated = await repositories.events.update(actor.organizationId, eventId, {
      modules: { ...modules, places: rest },
    });
    await repositories.activity.record({
      organizationId: actor.organizationId,
      entityType: "event",
      entityId: eventId,
      action: "event.updated",
      ...actorRef(actor),
      data: { fields: ["minimum"] },
    });
    return updated;
  });
}

/**
 * Seuil de maintien (module Places), appelé par la tâche planifiée à J-x : si l'événement
 * publié n'a toujours pas assez d'inscrits, il est annulé par le système, avec le parcours
 * d'annulation habituel. Revérifié sous le verrou ; renvoie null s'il est maintenu.
 */
export async function cancelEventBelowMinimum(
  deps: Deps,
  organizationId: string,
  eventId: string,
): Promise<{ event: Event; cancelledBookings: number; seats: number } | null> {
  const actor: Actor = { type: "system", organizationId };
  return deps.uow.run(async (repositories) => {
    const locked = await repositories.events.lockForBooking(organizationId, eventId);
    if (locked?.event.status !== "published") return null;
    const now = deps.clock.now();
    const seats = await repositories.bookings.seatsHeld(eventId);
    if (minimumState(locked.event.startsAt, locked.event.modules.places, seats, now) !== "cancel")
      return null;
    const result = await cancelLockedEvent(
      repositories,
      actor,
      locked.event,
      now,
      "minimum_not_reached",
    );
    return { ...result, seats };
  });
}
