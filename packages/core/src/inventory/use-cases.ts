import { z } from "zod";
import type { CustomerContact } from "../bookings/model";
import { formatBookingReference, referencePeriod } from "../bookings/reference";
import { customerContactSchema } from "../bookings/schemas";
import { type Actor, actorRef, assertMemberCan } from "../shared/actor";
import { ConflictError, NotFoundError, ValidationError } from "../shared/errors";
import { generateToken, hashToken } from "../shared/tokens";
import type { Deps, Repositories } from "../shared/unit-of-work";
import { validate } from "../shared/validate";
import { assertValidPeriod, freeUnits, type Period } from "./availability";
import type { Item, ItemUnit } from "./model";
import { priceRental, referencePrefix } from "./pricing";
import {
  type CreateItemInput,
  createItemSchema,
  type EventItemInput,
  eventItemSchema,
  type MaintenanceInput,
  maintenanceSchema,
  type UpdateItemInput,
  updateItemSchema,
} from "./schemas";

/** « #3 » → 3 (tri des exemplaires). */
const unitNumber = (unit: ItemUnit) => Number(unit.label.replace(/\D/g, "")) || 0;
const inService = (units: ItemUnit[]) =>
  units.filter((unit) => unit.status !== "retired").sort((a, b) => unitNumber(a) - unitNumber(b));

async function lockItemOrThrow(repositories: Repositories, organizationId: string, itemId: string) {
  const locked = await repositories.inventory.lockItem(organizationId, itemId);
  if (!locked || locked.item.archivedAt) throw new NotFoundError("Article", itemId);
  return locked;
}

async function generateReference(repositories: Repositories, organizationId: string, name: string) {
  const prefix = referencePrefix(name);
  for (let attempt = 0; attempt < 20; attempt++) {
    const sequence = await repositories.references.next(organizationId, `item:${prefix}`, "0000");
    const reference = `${prefix}-${String(sequence).padStart(3, "0")}`;
    if (!(await repositories.inventory.referenceExists(organizationId, reference)))
      return reference;
  }
  throw new ConflictError("Impossible de générer une référence : indique-la à la main");
}

/** Ajout d'un article avec ses exemplaires #1…#n (écran 20, « Ajouter un article »). */
export async function createItem(deps: Deps, actor: Actor, input: CreateItemInput): Promise<Item> {
  assertMemberCan(actor, "inventory", "create");
  const { quantity, typeName, ...data } = validate(createItemSchema, input);

  return deps.uow.run(async (repositories) => {
    const reference =
      data.reference || (await generateReference(repositories, actor.organizationId, data.name));
    if (
      data.reference &&
      (await repositories.inventory.referenceExists(actor.organizationId, reference))
    ) {
      throw new ConflictError(`La référence ${reference} est déjà utilisée`);
    }
    const item = await repositories.inventory.insertItem({
      ...data,
      reference,
      organizationId: actor.organizationId,
      itemTypeId: typeName
        ? await repositories.inventory.upsertItemType(actor.organizationId, typeName)
        : null,
    });
    await repositories.inventory.insertUnits(
      actor.organizationId,
      item.id,
      Array.from({ length: quantity }, (_, index) => `#${index + 1}`),
    );
    await repositories.activity.record({
      organizationId: actor.organizationId,
      entityType: "item",
      entityId: item.id,
      action: "item.created",
      ...actorRef(actor),
      data: { quantity },
    });
    return item;
  });
}

export async function updateItem(
  deps: Deps,
  actor: Actor,
  itemId: string,
  input: UpdateItemInput,
): Promise<Item> {
  assertMemberCan(actor, "inventory", "update");
  const { typeName, ...patch } = validate(updateItemSchema, input);

  return deps.uow.run(async (repositories) => {
    await lockItemOrThrow(repositories, actor.organizationId, itemId);
    if (patch.reference !== undefined) {
      if (!patch.reference)
        throw new ValidationError("Référence requise", [
          { path: "reference", message: "Référence requise" },
        ]);
      if (
        await repositories.inventory.referenceExists(actor.organizationId, patch.reference, itemId)
      ) {
        throw new ConflictError(`La référence ${patch.reference} est déjà utilisée`);
      }
    }
    const updated = await repositories.inventory.updateItem(actor.organizationId, itemId, {
      ...patch,
      ...(typeName !== undefined
        ? {
            itemTypeId: typeName
              ? await repositories.inventory.upsertItemType(actor.organizationId, typeName)
              : null,
          }
        : {}),
    });
    await repositories.activity.record({
      organizationId: actor.organizationId,
      entityType: "item",
      entityId: itemId,
      action: "item.updated",
      ...actorRef(actor),
      data: { fields: Object.keys(input) },
    });
    return updated;
  });
}

/**
 * Change le nombre d'exemplaires. On ajoute à la suite (#4, #5…) ; pour réduire, on
 * retire les derniers, seulement s'ils n'ont aucune réservation à venir.
 */
export async function setItemQuantity(
  deps: Deps,
  actor: Actor,
  itemId: string,
  quantity: number,
): Promise<void> {
  assertMemberCan(actor, "inventory", "update");
  if (!Number.isInteger(quantity) || quantity < 1 || quantity > 500) {
    throw new ValidationError("Quantité invalide", [
      { path: "quantity", message: "Entre 1 et 500 exemplaires" },
    ]);
  }

  await deps.uow.run(async (repositories) => {
    const { units } = await lockItemOrThrow(repositories, actor.organizationId, itemId);
    const active = inService(units);
    if (quantity > active.length) {
      const last = Math.max(0, ...units.map(unitNumber));
      await repositories.inventory.insertUnits(
        actor.organizationId,
        itemId,
        Array.from({ length: quantity - active.length }, (_, index) => `#${last + index + 1}`),
      );
    } else if (quantity < active.length) {
      const removed = active.slice(quantity);
      const upcoming = await repositories.inventory.activeAllocations(
        removed.map((unit) => unit.id),
        { startsAt: deps.clock.now() },
      );
      const busy = removed.find((unit) =>
        upcoming.some((allocation) => allocation.itemUnitId === unit.id),
      );
      if (busy) {
        throw new ConflictError(
          `L'exemplaire ${busy.label} a des réservations à venir : libère-le avant de réduire la quantité`,
        );
      }
      await repositories.inventory.setUnitStatus(
        actor.organizationId,
        removed.map((unit) => unit.id),
        "retired",
      );
    }
    await repositories.activity.record({
      organizationId: actor.organizationId,
      entityType: "item",
      entityId: itemId,
      action: "item.quantity_changed",
      ...actorRef(actor),
      data: { from: active.length, to: quantity },
    });
  });
}

/** Exemplaires libres sur une période ; ConflictError s'il n'y en a pas assez. */
async function pickFreeUnits(
  repositories: Repositories,
  units: ItemUnit[],
  period: Period,
  quantity: number,
) {
  const service = inService(units);
  const allocations = await repositories.inventory.activeAllocations(
    service.map((unit) => unit.id),
    period,
  );
  const free = freeUnits(service, allocations, period);
  if (free.length < quantity) {
    throw new ConflictError(
      free.length === 0
        ? "Aucun exemplaire libre sur ces dates"
        : `Il ne reste que ${free.length} exemplaire${free.length > 1 ? "s" : ""} libre${free.length > 1 ? "s" : ""} sur ces dates`,
    );
  }
  return { free: free.slice(0, quantity), allocations };
}

/**
 * Matériel d'un événement : fixe le nombre d'exemplaires réservés pour toute la durée
 * de l'événement (en ajoute ou en libère pour atteindre `quantity`).
 */
export async function setEventItemQuantity(
  deps: Deps,
  actor: Actor,
  input: EventItemInput,
): Promise<number> {
  assertMemberCan(actor, "event", "update");
  const data = validate(eventItemSchema, input);

  return deps.uow.run(async (repositories) => {
    const locked = await repositories.events.lockForBooking(actor.organizationId, data.eventId);
    if (!locked) throw new NotFoundError("Événement", data.eventId);
    if (locked.event.status === "cancelled") throw new ConflictError("Cet événement est annulé");
    const { units } = await lockItemOrThrow(repositories, actor.organizationId, data.itemId);
    const period = { startsAt: locked.event.startsAt, endsAt: locked.event.endsAt };

    const service = inService(units);
    const overlapping = await repositories.inventory.activeAllocations(
      service.map((unit) => unit.id),
      period,
    );
    const current = overlapping.filter((allocation) => allocation.eventId === data.eventId);

    if (data.quantity > current.length) {
      const { free } = await pickFreeUnits(
        repositories,
        units,
        period,
        data.quantity - current.length,
      );
      await repositories.inventory.insertAllocations(
        free.map((unit) => ({
          organizationId: actor.organizationId,
          itemUnitId: unit.id,
          kind: "event" as const,
          eventId: data.eventId,
          bookingId: null,
          ...period,
          title: null,
          provider: null,
          costCents: null,
          note: null,
          createdByMemberId: actor.memberId,
        })),
      );
    } else if (data.quantity < current.length) {
      await repositories.inventory.cancelAllocations(
        actor.organizationId,
        { allocationIds: current.slice(data.quantity).map((allocation) => allocation.id) },
        deps.clock.now(),
      );
    }
    await repositories.activity.record({
      organizationId: actor.organizationId,
      entityType: "event",
      entityId: data.eventId,
      action: "event.items_changed",
      ...actorRef(actor),
      data: { itemId: data.itemId, quantity: data.quantity },
    });
    return data.quantity;
  });
}

export async function removeEventItem(
  deps: Deps,
  actor: Actor,
  eventId: string,
  itemId: string,
): Promise<void> {
  assertMemberCan(actor, "event", "update");
  await deps.uow.run(async (repositories) => {
    await repositories.inventory.cancelAllocations(
      actor.organizationId,
      { eventId, itemId },
      deps.clock.now(),
    );
  });
}

/** Intervention de maintenance sur un ou plusieurs exemplaires (immobilisés sur la période). */
export async function scheduleMaintenance(
  deps: Deps,
  actor: Actor,
  input: MaintenanceInput,
): Promise<void> {
  assertMemberCan(actor, "inventory", "update");
  const data = validate(maintenanceSchema, input);
  assertValidPeriod(data);

  await deps.uow.run(async (repositories) => {
    const { units } = await lockItemOrThrow(repositories, actor.organizationId, data.itemId);
    const targets = units.filter(
      (unit) => data.unitIds.includes(unit.id) && unit.status !== "retired",
    );
    if (targets.length !== data.unitIds.length)
      throw new NotFoundError("Exemplaire", data.unitIds.join(", "));
    const allocations = await repositories.inventory.activeAllocations(
      targets.map((unit) => unit.id),
      data,
    );
    const taken = targets.find((unit) =>
      allocations.some((allocation) => allocation.itemUnitId === unit.id),
    );
    if (taken)
      throw new ConflictError(`L'exemplaire ${taken.label} est déjà pris sur cette période`);

    await repositories.inventory.insertAllocations(
      targets.map((unit) => ({
        organizationId: actor.organizationId,
        itemUnitId: unit.id,
        kind: "maintenance" as const,
        eventId: null,
        bookingId: null,
        startsAt: data.startsAt,
        endsAt: data.endsAt,
        title: data.title,
        provider: data.provider,
        costCents: data.costCents,
        note: data.note,
        createdByMemberId: actor.memberId,
      })),
    );
    await repositories.activity.record({
      organizationId: actor.organizationId,
      entityType: "item",
      entityId: data.itemId,
      action: "item.maintenance_scheduled",
      ...actorRef(actor),
      data: { title: data.title, units: targets.map((unit) => unit.label) },
    });
  });
}

export async function cancelMaintenance(
  deps: Deps,
  actor: Actor,
  allocationId: string,
): Promise<void> {
  assertMemberCan(actor, "inventory", "update");
  await deps.uow.run(async (repositories) => {
    const allocation = await repositories.inventory.findAllocation(
      actor.organizationId,
      allocationId,
    );
    if (allocation?.kind !== "maintenance") throw new NotFoundError("Intervention", allocationId);
    if (allocation.cancelledAt) throw new ConflictError("Cette intervention est déjà annulée");
    await repositories.inventory.cancelAllocations(
      actor.organizationId,
      { allocationIds: [allocationId] },
      deps.clock.now(),
    );
  });
}

const rentalSchema = z.object({
  itemId: z.uuid(),
  quantity: z.int({ error: "Quantité invalide" }).min(1, "Au moins un exemplaire").max(500),
  startsAt: z.coerce.date({ error: "Date ou heure invalide" }),
  endsAt: z.coerce.date({ error: "Date ou heure invalide" }),
  customer: customerContactSchema,
  customerMessage: z
    .string()
    .trim()
    .max(1000)
    .nullish()
    .transform((value) => value || null),
});
export type CreateRentalInput = z.input<typeof rentalSchema>;

/**
 * Location de matériel seule (« Réserver » sur la fiche article) : une réservation de type
 * location, confirmée, et ses exemplaires bloqués sur la période.
 */
export async function createRentalBooking(
  deps: Deps,
  actor: Actor,
  input: CreateRentalInput,
): Promise<{ bookingId: string; reference: string; manageToken: string }> {
  assertMemberCan(actor, "booking", "create");
  const data = validate(rentalSchema, input);
  assertValidPeriod(data);
  const manageToken = generateToken();
  const manageTokenHash = await hashToken(manageToken);

  return deps.uow.run(async (repositories) => {
    const { item, units } = await lockItemOrThrow(repositories, actor.organizationId, data.itemId);
    const period = { startsAt: data.startsAt, endsAt: data.endsAt };
    const { free } = await pickFreeUnits(repositories, units, period, data.quantity);

    const customer = await repositories.customers.upsertByEmail(
      actor.organizationId,
      data.customer as CustomerContact,
    );
    const settings = await repositories.settings.get(actor.organizationId);
    const now = deps.clock.now();
    const referencePeriodKey = referencePeriod(now, settings.timezone);
    const sequence = await repositories.references.next(
      actor.organizationId,
      "booking",
      referencePeriodKey,
    );
    const amountCents = priceRental(item.dailyRateCents, data.quantity, data.startsAt, data.endsAt);

    const booking = await repositories.bookings.insert(
      {
        organizationId: actor.organizationId,
        reference: formatBookingReference(
          settings.bookingReferencePrefix,
          referencePeriodKey,
          sequence,
        ),
        kind: "rental",
        eventId: null,
        customerId: customer.id,
        seats: data.quantity,
        status: "confirmed",
        amountCents,
        depositCents: null,
        currency: settings.currency,
        paymentMode: amountCents > 0 ? "on_site" : "free",
        customerMessage: data.customerMessage,
        source: "admin",
        confirmedAt: now,
        manageTokenHash,
        rentalStartsAt: data.startsAt,
        rentalEndsAt: data.endsAt,
      },
      [],
    );
    await repositories.inventory.insertAllocations(
      free.map((unit) => ({
        organizationId: actor.organizationId,
        itemUnitId: unit.id,
        kind: "rental" as const,
        eventId: null,
        bookingId: booking.id,
        ...period,
        title: null,
        provider: null,
        costCents: null,
        note: null,
        createdByMemberId: actor.memberId,
      })),
    );
    await repositories.activity.record({
      organizationId: actor.organizationId,
      entityType: "booking",
      entityId: booking.id,
      action: "booking.created",
      ...actorRef(actor),
      data: { status: "confirmed", kind: "rental", itemId: item.id, quantity: data.quantity },
    });
    return { bookingId: booking.id, reference: booking.reference, manageToken };
  });
}
