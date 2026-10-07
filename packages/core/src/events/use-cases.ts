import { promoteWaitlist } from "../bookings/waitlist";
import { type Actor, actorRef, assertMemberCan } from "../shared/actor";
import { NotFoundError } from "../shared/errors";
import { toZonedParts } from "../shared/time";
import type { Deps, Repositories } from "../shared/unit-of-work";
import { validate } from "../shared/validate";
import { slugify } from "../tenants/workspace";
import type { Event, EventType } from "./model";
import type { EventPatch } from "./ports";
import { generateOccurrences, toRRule } from "./recurrence";
import {
  assertCanCancel,
  assertCanEdit,
  assertCanPublish,
  assertCapacityFits,
  assertEventConsistency,
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

export async function createEventType(
  deps: Deps,
  actor: Actor,
  input: CreateEventTypeInput,
): Promise<EventType> {
  assertMemberCan(actor, "event", "create");
  const data = validate(createEventTypeSchema, input);

  return deps.uow.run(async (repositories) => {
    const eventType = await repositories.eventTypes.insert({
      organizationId: actor.organizationId,
      ...data,
      defaultDurationMinutes: data.defaultDurationMinutes ?? null,
      defaultPriceCents: data.defaultPriceCents ?? null,
      defaultCapacity: data.defaultCapacity ?? null,
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
  const patch = validate(updateEventTypeSchema, input);

  return deps.uow.run(async (repositories) => {
    const existing = await repositories.eventTypes.find(actor.organizationId, eventTypeId);
    if (!existing || existing.archivedAt) throw new NotFoundError("Type d'événement", eventTypeId);
    const updated = await repositories.eventTypes.update(actor.organizationId, eventTypeId, patch);
    await repositories.activity.record({
      organizationId: actor.organizationId,
      entityType: "event_type",
      entityId: eventTypeId,
      action: "event_type.updated",
      ...actorRef(actor),
      data: { fields: Object.keys(patch) },
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

/** Adresse unique dans l'espace : « seminaire-annuel », puis « seminaire-annuel-2 »… */
async function uniqueSlug(repositories: Repositories, organizationId: string, base: string) {
  const root = base || "evenement";
  for (let attempt = 1; attempt <= 50; attempt++) {
    const slug = attempt === 1 ? root : `${root}-${attempt}`;
    if (!(await repositories.events.slugExists(organizationId, slug))) return slug;
  }
  return `${root}-${Date.now().toString(36)}`;
}

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
  const { eventTypeId, recurrence, requiresApproval, ...details } = validate(
    createEventSchema,
    input,
  );
  assertEventConsistency(details);

  const starts = recurrence
    ? generateOccurrences(recurrence, details.startsAt, details.timezone)
    : [details.startsAt];
  const duration = details.endsAt.getTime() - details.startsAt.getTime();

  return deps.uow.run(async (repositories) => {
    const eventType = await repositories.eventTypes.find(actor.organizationId, eventTypeId);
    if (!eventType || eventType.archivedAt)
      throw new NotFoundError("Type d'événement", eventTypeId);
    const settings = await repositories.settings.get(actor.organizationId);

    const series = recurrence
      ? await repositories.events.insertSeries({
          organizationId: actor.organizationId,
          rrule: toRRule(recurrence),
          until: starts.at(-1) ?? null,
          timezone: details.timezone,
        })
      : null;

    const created: Event[] = [];
    for (const startsAt of starts) {
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
        startsAt,
        endsAt: new Date(startsAt.getTime() + duration),
        currency: settings.currency,
        requiresApproval: requiresApproval ?? eventType.requiresApproval,
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
  const patch = validate(updateEventSchema, input) as EventPatch;

  return deps.uow.run(async (repositories) => {
    const locked = await repositories.events.lockForBooking(actor.organizationId, eventId);
    if (!locked) throw new NotFoundError("Événement", eventId);
    const { event } = locked;
    assertCanEdit(event);

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

/**
 * Annule un événement et toutes ses réservations actives.
 * (Les remboursements et e-mails aux participants arrivent avec les paiements.)
 */
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
    assertCanCancel(locked.event);
    const now = deps.clock.now();

    const event = await repositories.events.update(actor.organizationId, eventId, {
      status: "cancelled",
      cancelledAt: now,
    });
    await repositories.inventory.cancelAllocations(actor.organizationId, { eventId }, now);
    const active = await repositories.bookings.listActive(eventId);
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
        data: { reason: "event_cancelled" },
      });
    }
    await repositories.activity.record({
      organizationId: actor.organizationId,
      entityType: "event",
      entityId: eventId,
      action: "event.cancelled",
      ...actorRef(actor),
      data: { reason: reason ?? null, cancelledBookings: active.length },
    });
    return { event, cancelledBookings: active.length };
  });
}
