import type { Event } from "../events/model";
import type { EquipmentChoice } from "../modules/registry";
import {
  type EquipmentCandidate,
  equipmentCandidates,
  needSeats,
  planEquipment,
  unitLabel,
} from "../modules/resources";
import type { Actor } from "../shared/actor";
import type { Repositories } from "../shared/unit-of-work";

type EquipmentEvent = Pick<Event, "id" | "organizationId" | "startsAt" | "endsAt" | "modules">;

/**
 * Module Matériel avancé : réserve les exemplaires d'une réservation d'événement, sous le verrou
 * de l'événement. Chaque exemplaire est pris par une allocation (même contrainte d'exclusion que
 * tout le matériel : jamais deux fois). Rien n'est écrit si un besoin ne peut pas être servi.
 * `byTeam` : l'équipe ou le système réserve, rien n'est demandé à l'élève.
 */
export async function reserveEquipment(
  repositories: Repositories,
  actor: Actor,
  event: EquipmentEvent,
  bookingId: string,
  seats: number,
  choices: readonly EquipmentChoice[],
  byTeam: boolean,
  /** Matériel facultatif lié à une option payante : places qui la prennent (`optionNeedSeats`). */
  linked: Readonly<Record<string, number>> = {},
): Promise<string[]> {
  const needs = event.modules.equipment?.needs ?? [];
  if (needs.length === 0) return [];
  const period = { startsAt: event.startsAt, endsAt: event.endsAt };
  const candidates: Record<string, EquipmentCandidate[]> = {};
  const names: Record<string, string> = {};
  for (const need of needs) {
    if (needSeats(need, seats, choices, linked) === 0) continue;
    const found = await repositories.inventory.unitsOfItemType(
      event.organizationId,
      need.itemTypeId,
    );
    const units = found?.units ?? [];
    names[need.id] = found?.name ?? "Matériel";
    candidates[need.id] = equipmentCandidates({
      units,
      allocations: await repositories.inventory.activeAllocations(
        units.map((unit) => unit.id),
        period,
      ),
      period,
      eventId: event.id,
      restrictTo: need.unitIds,
    });
  }
  const planned = planEquipment({ needs, seats, choices, candidates, names, byTeam, linked });

  // Déjà réservés à l'événement : on les attribue. Les autres : nouvelle allocation.
  for (const need of needs) {
    const ids = planned
      .filter((entry) => entry.needId === need.id && entry.allocationId)
      .map((entry) => entry.allocationId as string);
    await repositories.inventory.assignAllocations(event.organizationId, ids, bookingId, need.id);
  }
  await repositories.inventory.insertAllocations(
    planned
      .filter((entry) => !entry.allocationId)
      .map((entry) => ({
        organizationId: event.organizationId,
        itemUnitId: entry.unit.id,
        kind: "event" as const,
        eventId: event.id,
        bookingId,
        needId: entry.needId,
        ...period,
        title: null,
        provider: null,
        costCents: null,
        note: null,
        createdByMemberId: actor.type === "member" ? actor.memberId : null,
      })),
  );
  return planned.map((entry) => unitLabel(entry.unit));
}

/**
 * Stage « Même tour à chaque séance » (lot 37) : réserve à l'élève les mêmes exemplaires sur
 * toutes ses séances d'un coup. Seuls comptent les exemplaires libres sur chacune d'elles ;
 * rien n'est écrit si un besoin ne peut pas être servi partout.
 */
export async function reserveSameEquipment(
  repositories: Repositories,
  actor: Actor,
  targets: ReadonlyArray<{ event: EquipmentEvent; bookingId: string }>,
  seats: number,
): Promise<string[]> {
  const first = targets[0];
  const needs = first?.event.modules.equipment?.needs ?? [];
  if (!first || needs.length === 0) return [];
  const candidates: Record<string, EquipmentCandidate[]> = {};
  const perTarget = new Map<string, Record<string, EquipmentCandidate[]>>();
  const names: Record<string, string> = {};
  for (const need of needs) {
    if (needSeats(need, seats, []) === 0) continue;
    const found = await repositories.inventory.unitsOfItemType(
      first.event.organizationId,
      need.itemTypeId,
    );
    const units = found?.units ?? [];
    names[need.id] = found?.name ?? "Matériel";
    let common: EquipmentCandidate[] | null = null;
    for (const { event, bookingId } of targets) {
      const period = { startsAt: event.startsAt, endsAt: event.endsAt };
      const list = equipmentCandidates({
        units,
        allocations: await repositories.inventory.activeAllocations(
          units.map((unit) => unit.id),
          period,
        ),
        period,
        eventId: event.id,
        restrictTo: need.unitIds,
      });
      perTarget.set(bookingId, { ...perTarget.get(bookingId), [need.id]: list });
      const ids = new Set(list.map((entry) => entry.unit.id));
      common = (common ?? list.map((entry) => ({ unit: entry.unit }))).filter((entry) =>
        ids.has(entry.unit.id),
      );
    }
    candidates[need.id] = common ?? [];
  }
  const planned = planEquipment({ needs, seats, choices: [], candidates, names, byTeam: true });

  for (const { event, bookingId } of targets) {
    const own = perTarget.get(bookingId) ?? {};
    const period = { startsAt: event.startsAt, endsAt: event.endsAt };
    const pooled = planned.map((entry) => ({
      ...entry,
      allocationId: own[entry.needId]?.find((candidate) => candidate.unit.id === entry.unit.id)
        ?.allocationId,
    }));
    for (const need of needs) {
      const ids = pooled
        .filter((entry) => entry.needId === need.id && entry.allocationId)
        .map((entry) => entry.allocationId as string);
      await repositories.inventory.assignAllocations(event.organizationId, ids, bookingId, need.id);
    }
    await repositories.inventory.insertAllocations(
      pooled
        .filter((entry) => !entry.allocationId)
        .map((entry) => ({
          organizationId: event.organizationId,
          itemUnitId: entry.unit.id,
          kind: "event" as const,
          eventId: event.id,
          bookingId,
          needId: entry.needId,
          ...period,
          title: null,
          provider: null,
          costCents: null,
          note: null,
          createdByMemberId: actor.type === "member" ? actor.memberId : null,
        })),
    );
  }
  return planned.map((entry) => unitLabel(entry.unit));
}
