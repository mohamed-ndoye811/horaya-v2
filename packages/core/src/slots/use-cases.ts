import { z } from "zod";
import { defaultRate } from "../bookings/pricing";
import type { Event, EventType } from "../events/model";
import { uniqueSlug } from "../events/use-cases";
import type { Period } from "../inventory/availability";
import { eventPlace } from "../modules/resources";
import {
  type CivilDate,
  civilDateOf,
  durationOf,
  generateSlots,
  pickSlotOption,
  type Slot,
  type SlotInput,
  slotMinutes,
  withChosenDuration,
} from "../modules/time";
import { type Actor, actorRef } from "../shared/actor";
import { ConflictError, NotFoundError } from "../shared/errors";
import { fromZonedParts } from "../shared/time";
import type { Deps, Repositories } from "../shared/unit-of-work";
import { validate } from "../shared/validate";
import { slugify } from "../tenants/workspace";
import type { SlotHold } from "./ports";

/**
 * Créneaux (lot 37) : l'élève choisit un moment dans les disponibilités du type. Rien n'existe
 * avant la réservation : les créneaux libres sont calculés à la volée (`generateSlots`), et la
 * réservation crée l'événement du créneau (ou complète celui qui existe déjà).
 *
 * Tout ce qui réserve un créneau passe par le verrou des créneaux de l'espace : deux élèves sur
 * le même créneau sont servis l'un après l'autre, le second voit le créneau pris. Le matériel
 * garde sa contrainte d'exclusion, l'intervenant la sienne (`event_slot_staff_no_overlap`).
 */

/** Le créneau est gardé 10 minutes pendant le formulaire. */
export const SLOT_HOLD_MINUTES = 10;
const DAY = 86_400_000;

export const slotChoiceSchema = z.object({
  eventTypeId: z.uuid(),
  startsAt: z.coerce.date({ error: "Créneau invalide" }),
  durationId: z.string().max(40).nullish(),
  /** Intervenant choisi ; absent : « Peu importe ». */
  staffMemberId: z.uuid().nullish(),
  seats: z.int().min(1, "Au moins une place").max(100).default(1),
});
export type SlotChoice = z.output<typeof slotChoiceSchema>;
export type SlotChoiceInput = z.input<typeof slotChoiceSchema>;

/** Le type et ses créneaux : un type actif avec le module Créneaux. */
async function slotType(repositories: Repositories, organizationId: string, eventTypeId: string) {
  const eventType = await repositories.eventTypes.find(organizationId, eventTypeId);
  if (!eventType?.modules.slots || eventType.archivedAt) {
    throw new NotFoundError("Type d'événement", eventTypeId);
  }
  return { eventType, slots: eventType.modules.slots };
}

/** Matériel obligatoire du type : exemplaires (en service) et leur occupation sur la période. */
async function equipmentLoad(
  repositories: Repositories,
  organizationId: string,
  eventType: EventType,
  period: Period,
): Promise<SlotInput["equipment"]> {
  const needs = (eventType.modules.equipment?.needs ?? []).filter((need) => need.required);
  const load = [];
  for (const need of needs) {
    const found = await repositories.inventory.unitsOfItemType(organizationId, need.itemTypeId);
    const units = (found?.units ?? []).filter(
      (unit) =>
        unit.status === "available" && (!need.unitIds?.length || need.unitIds.includes(unit.id)),
    );
    const allocations = await repositories.inventory.activeAllocations(
      units.map((unit) => unit.id),
      period,
    );
    load.push({
      quantity: need.perSeat,
      units: units.map((unit) =>
        allocations.filter((entry) => entry.itemUnitId === unit.id && entry.cancelledAt === null),
      ),
    });
  }
  return load;
}

/**
 * Créneaux libres d'un type sur `days` jours à partir de `from` (jours civils du fuseau de
 * l'espace). L'équipe (`team`) n'est pas tenue par la fenêtre de réservation en ligne.
 */
export async function findSlots(
  repositories: Repositories,
  organizationId: string,
  eventType: EventType,
  options: {
    from: CivilDate;
    days: number;
    now: Date;
    timeZone: string;
    durationId?: string | null;
    exceptHoldId?: string;
    team?: boolean;
  },
): Promise<Slot[]> {
  const slots = eventType.modules.slots;
  if (!slots) return [];
  const start = fromZonedParts({ ...options.from, hour: 0, minute: 0 }, options.timeZone);
  // Un jour de marge de chaque côté : pauses et créneaux à cheval sur minuit.
  const period = {
    startsAt: new Date(start.getTime() - DAY),
    endsAt: new Date(start.getTime() + (options.days + 1) * DAY),
  };
  const members = slots.memberIds ?? [];
  const [taken, staffBusy, equipment] = await Promise.all([
    repositories.slots.taken(
      organizationId,
      eventType.id,
      period,
      options.now,
      options.exceptHoldId,
    ),
    members.length
      ? repositories.slots.staffBusy(
          organizationId,
          members,
          period,
          options.now,
          options.exceptHoldId,
        )
      : Promise.resolve({}),
    equipmentLoad(repositories, organizationId, eventType, period),
  ]);
  return generateSlots({
    slots: options.team
      ? { ...slots, opensDaysBefore: undefined, closesHoursBefore: undefined }
      : slots,
    durationMinutes: slotMinutes(
      eventType.modules,
      eventType.defaultDurationMinutes,
      options.durationId,
    ),
    timeZone: options.timeZone,
    from: options.from,
    days: options.days,
    now: options.now,
    taken,
    staffBusy,
    equipment,
  });
}

/** Le créneau demandé, s'il est encore libre (sous le verrou) : l'option retenue. */
async function freeOption(
  repositories: Repositories,
  actor: Actor,
  eventType: EventType,
  choice: SlotChoice,
  now: Date,
  exceptHoldId?: string,
) {
  const settings = await repositories.settings.get(actor.organizationId);
  const found = await findSlots(repositories, actor.organizationId, eventType, {
    from: civilDateOf(choice.startsAt, settings.timezone),
    days: 1,
    now,
    timeZone: settings.timezone,
    durationId: choice.durationId,
    exceptHoldId,
    team: actor.type === "member",
  });
  const slot = found.find((entry) => entry.startsAt.getTime() === choice.startsAt.getTime());
  const option = pickSlotOption(slot, choice.staffMemberId ?? null, choice.seats);
  if (!slot || !option) {
    throw new ConflictError("Ce créneau vient d'être pris : choisis-en un autre");
  }
  return { slot, option, settings };
}

/**
 * Garde un créneau 10 minutes (« Continuer » sur la page du type) : il disparaît pour les
 * autres élèves le temps du formulaire. Les créneaux gardés expirés sont nettoyés au passage.
 */
export async function holdSlot(
  deps: Deps,
  actor: Actor,
  input: SlotChoiceInput,
): Promise<SlotHold> {
  const choice = validate(slotChoiceSchema, input);
  return deps.uow.run(async (repositories) => {
    await repositories.slots.lock(actor.organizationId);
    const now = deps.clock.now();
    await repositories.slots.deleteExpiredHolds(actor.organizationId, now);
    const { eventType } = await slotType(repositories, actor.organizationId, choice.eventTypeId);
    const { slot, option } = await freeOption(repositories, actor, eventType, choice, now);
    return repositories.slots.insertHold({
      organizationId: actor.organizationId,
      eventTypeId: eventType.id,
      startsAt: slot.startsAt,
      endsAt: slot.endsAt,
      durationId: eventType.modules.duration
        ? durationOf(eventType.modules.duration, choice.durationId).id
        : null,
      staffMemberId: option.staffMemberId,
      eventId: option.eventId,
      seats: choice.seats,
      expiresAt: new Date(now.getTime() + SLOT_HOLD_MINUTES * 60_000),
    });
  });
}

/** Le créneau gardé : relu tel quel, même expiré (il sera revérifié à la réservation). */
export async function findSlotHold(
  repositories: Repositories,
  organizationId: string,
  holdId: string,
): Promise<SlotHold> {
  const hold = await repositories.slots.findHold(organizationId, holdId);
  if (!hold) throw new ConflictError("Ce créneau n'est plus gardé : choisis-en un autre");
  return hold;
}

/**
 * Sous le verrou des créneaux : vérifie que le créneau est toujours libre, puis rend l'événement
 * à réserver, verrouillé. Créneau déjà réservé avec des places : son événement ; sinon un nouvel
 * événement publié, à l'heure et pour la durée choisies, avec l'intervenant retenu.
 */
export async function lockSlotEvent(
  repositories: Repositories,
  actor: Actor,
  input: SlotChoiceInput,
  now: Date,
  exceptHoldId?: string,
): Promise<{ event: Event; eventType: EventType }> {
  const choice = validate(slotChoiceSchema, input);
  await repositories.slots.lock(actor.organizationId);
  const { eventType } = await slotType(repositories, actor.organizationId, choice.eventTypeId);
  const { slot, option, settings } = await freeOption(
    repositories,
    actor,
    eventType,
    choice,
    now,
    exceptHoldId,
  );
  const existing = option.eventId
    ? await repositories.events.lockForBooking(actor.organizationId, option.eventId)
    : null;
  if (existing) return existing;

  const duration = eventType.modules.duration
    ? durationOf(eventType.modules.duration, choice.durationId)
    : null;
  const modules = duration ? withChosenDuration(eventType.modules, duration) : eventType.modules;
  const priceCents = duration
    ? duration.priceCents
    : modules.pricing
      ? defaultRate(modules.pricing).priceCents
      : (eventType.defaultPriceCents ?? 0);
  const place = eventPlace(
    modules.location,
    { locationName: null, locationAddress: null, onlineUrl: null },
    settings.address ?? null,
  );
  const startsLocal = civilDateOf(slot.startsAt, settings.timezone);
  const created = await repositories.events.insert({
    organizationId: actor.organizationId,
    eventTypeId: eventType.id,
    seriesId: null,
    title: eventType.name,
    slug: await uniqueSlug(
      repositories,
      actor.organizationId,
      `${slugify(eventType.name)}-${startsLocal.year}-${String(startsLocal.month).padStart(2, "0")}-${String(startsLocal.day).padStart(2, "0")}`,
    ),
    description: eventType.description ?? "",
    visibility: "public",
    startsAt: slot.startsAt,
    endsAt: slot.endsAt,
    timezone: settings.timezone,
    ...place,
    capacity: modules.slots?.seatsPerSlot ?? 1,
    priceCents,
    currency: settings.currency,
    paymentMode: priceCents > 0 ? (modules.deposit ? "deposit" : "on_site") : "free",
    requiresApproval: Boolean(modules.approval),
    highlights: [],
    paymentLinkUrl: null,
    fields: eventType.fields,
    modules,
    rules: eventType.rules,
    fieldValues: {},
    staffMemberId: option.staffMemberId,
    fromSlot: true,
  });
  await repositories.events.update(actor.organizationId, created.id, {
    status: "published",
    publishedAt: now,
  });
  await repositories.activity.record({
    organizationId: actor.organizationId,
    entityType: "event",
    entityId: created.id,
    action: "event.created",
    ...actorRef(actor),
    data: { slot: true },
  });
  const locked = await repositories.events.lockForBooking(actor.organizationId, created.id);
  if (!locked) throw new NotFoundError("Événement", created.id);
  return locked;
}
