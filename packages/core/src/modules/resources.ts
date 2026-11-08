import type { FieldDefinition, FieldValues } from "../fields/model";
import { freeUnits, type Period, periodsOverlap } from "../inventory/availability";
import type { ItemUnitStatus } from "../inventory/types";
import { ConflictError, ValidationError } from "../shared/errors";
import type {
  EquipmentChoice,
  EquipmentNeed,
  EventModules,
  LocationModule,
  StaffModule,
} from "./registry";

/**
 * Modules « Ressources » (lot 34b) : matériel avancé, lieu, intervenant. Règles pures : les cas
 * d'usage et les requêtes de la page publique partagent les mêmes calculs.
 */

/* ---------- Matériel avancé ---------- */

/** Un exemplaire d'une catégorie de matériel, avec ce qu'il faut pour l'afficher. */
export interface EquipmentUnit {
  id: string;
  label: string;
  status: ItemUnitStatus;
  itemId: string;
  itemName: string;
  /** Caractéristiques de l'article, mises en forme (« Assise basse »). */
  details: string[];
}

/** Exemplaire proposé pour un besoin : libre, ou déjà réservé au matériel de l'événement. */
export interface EquipmentCandidate {
  unit: EquipmentUnit;
  /** Réservation de l'événement sans réservation : on l'attribue plutôt que d'en créer une. */
  allocationId?: string;
}

export interface PlannedUnit {
  needId: string;
  unit: EquipmentUnit;
  allocationId?: string;
}

export const needQuantity = (need: EquipmentNeed, seats: number) => need.perSeat * seats;

/**
 * Matériel facultatif lié à une option payante (lot 35) : l'option fait office de case. Rend, pour
 * chaque besoin lié, le nombre de places qui le prennent (0 : pas pris), d'après les quantités
 * d'options de la réservation (son détail de prix, déjà vérifié par `quoteBooking`).
 */
export function optionNeedSeats(
  event: { paymentMode: string; modules: EventModules },
  seats: number,
  lines: ReadonlyArray<{ kind: string; id: string; quantity: number }>,
): Record<string, number> {
  const linked: Record<string, number> = {};
  // Événement gratuit : pas d'option, le matériel facultatif garde sa case.
  if (event.paymentMode === "free") return linked;
  for (const option of event.modules.pricing?.options ?? []) {
    if (option.needId === undefined) continue;
    const quantity =
      lines.find((line) => line.kind === "option" && line.id === option.id)?.quantity ?? 0;
    linked[option.needId] =
      option.per === "participant" ? Math.min(quantity, seats) : quantity > 0 ? seats : 0;
  }
  return linked;
}

/**
 * Places qui prennent un besoin : toutes pour l'obligatoire ; pour le facultatif, toutes si la
 * case est cochée, ou celles de l'option liée (qui décide seule : la case envoyée est ignorée).
 */
export function needSeats(
  need: EquipmentNeed,
  seats: number,
  choices: readonly EquipmentChoice[],
  linked: Readonly<Record<string, number>> = {},
): number {
  if (need.required) return seats;
  const fromOption = linked[need.id];
  if (fromOption !== undefined) return fromOption;
  return choices.some((choice) => choice.needId === need.id && choice.wanted) ? seats : 0;
}

/** Caractéristiques d'un article : « Assise basse », « Diamètre : 30 ». */
export function describeItemValues(fields: FieldDefinition[], values: FieldValues): string[] {
  return fields.flatMap((field) => {
    const value = values[field.key];
    if (value === undefined || value === false || value === "") return [];
    if (value === true) return [field.label];
    if (typeof value === "number") return [`${field.label} : ${value.toLocaleString("fr-FR")}`];
    return [Array.isArray(value) ? value.join(", ") : value];
  });
}

/** « Tour Shimpo · Assise basse · #2 ». */
export const unitLabel = (unit: EquipmentUnit) =>
  [unit.itemName, ...unit.details, unit.label].join(" · ");

/**
 * Exemplaires que l'on peut attribuer à une réservation de l'événement : libres sur sa période
 * (miroir de la contrainte d'exclusion, qui reste la garantie finale) ou déjà réservés à
 * l'événement sans l'être à une réservation. `restrictTo` : l'événement ne propose que ceux-là.
 */
export function equipmentCandidates(input: {
  units: readonly EquipmentUnit[];
  allocations: ReadonlyArray<
    Period & {
      id: string;
      itemUnitId: string;
      eventId: string | null;
      bookingId: string | null;
      cancelledAt: Date | null;
    }
  >;
  period: Period;
  eventId: string;
  restrictTo?: readonly string[];
}): EquipmentCandidate[] {
  const { units, allocations, period, eventId, restrictTo } = input;
  const eligible = units.filter((unit) => !restrictTo?.length || restrictTo.includes(unit.id));
  const active = allocations.filter((entry) => entry.cancelledAt === null);
  const pooled = new Map(
    active
      .filter((entry) => entry.eventId === eventId && entry.bookingId === null)
      .map((entry) => [entry.itemUnitId, entry.id]),
  );
  const byUnit = (a: EquipmentCandidate, b: EquipmentCandidate) =>
    Number(Boolean(b.allocationId)) - Number(Boolean(a.allocationId)) ||
    a.unit.itemName.localeCompare(b.unit.itemName, "fr") ||
    a.unit.label.localeCompare(b.unit.label, "fr", { numeric: true });
  const free = new Set(freeUnits(eligible, active, period).map((unit) => unit.id));
  return eligible
    .filter(
      (unit) =>
        unit.status === "available" &&
        (free.has(unit.id) ||
          (pooled.has(unit.id) &&
            !active.some(
              (entry) =>
                entry.itemUnitId === unit.id &&
                entry.id !== pooled.get(unit.id) &&
                periodsOverlap(entry, period),
            ))),
    )
    .map((unit) => ({ unit, allocationId: pooled.get(unit.id) }))
    .sort(byUnit);
}

/**
 * Exemplaires à réserver pour une inscription de `seats` places.
 * - Obligatoire : toujours réservé. Facultatif : seulement si l'élève (`wanted`) le demande.
 * - L'atelier attribue : les premiers exemplaires libres. L'élève choisit : il doit désigner
 *   exactement la quantité demandée, parmi les exemplaires proposés. L'équipe (`byTeam`)
 *   n'a jamais à choisir : ce qu'elle ne désigne pas est attribué.
 * - Un exemplaire n'est jamais pris deux fois, ni pour deux besoins.
 */
export function planEquipment(input: {
  needs: readonly EquipmentNeed[];
  seats: number;
  choices: readonly EquipmentChoice[];
  candidates: Readonly<Record<string, EquipmentCandidate[]>>;
  /** Nom du besoin dans les messages (« Tour », « Tablier »). */
  names: Readonly<Record<string, string>>;
  byTeam: boolean;
  /** Besoins liés à une option payante : places qui la prennent (`optionNeedSeats`). */
  linked?: Readonly<Record<string, number>>;
}): PlannedUnit[] {
  const { needs, seats, choices, candidates, names, byTeam, linked } = input;
  const taken = new Set<string>();
  const planned: PlannedUnit[] = [];
  const issues: Array<{ path: string; message: string }> = [];

  for (const need of needs) {
    const choice = choices.find((entry) => entry.needId === need.id);
    const taking = needSeats(need, seats, choices, linked);
    if (taking === 0) continue;
    const quantity = needQuantity(need, taking);
    const name = (names[need.id] ?? "Matériel").toLowerCase();
    const available = (candidates[need.id] ?? []).filter((entry) => !taken.has(entry.unit.id));
    const chosen = choice?.unitIds ?? [];

    let picked: EquipmentCandidate[];
    if (need.chooser === "student" && !byTeam) {
      if (chosen.length !== quantity || new Set(chosen).size !== quantity) {
        issues.push({
          path: `equipment.${need.id}`,
          message:
            quantity > 1 ? `Choisis ${quantity} exemplaires (${name})` : `Choisis ton ${name}`,
        });
        continue;
      }
      picked = chosen.flatMap((unitId) => {
        const found = available.find((entry) => entry.unit.id === unitId);
        return found ? [found] : [];
      });
      if (picked.length < quantity) {
        // Choisi par quelqu'un d'autre entre-temps, ou hors de ce qui est proposé.
        throw new ConflictError(`Ce ${name} n'est plus disponible : choisis-en un autre`);
      }
    } else {
      // L'équipe qui désigne des exemplaires est suivie quand ils sont libres.
      const wished = chosen.flatMap((unitId) => {
        const found = available.find((entry) => entry.unit.id === unitId);
        return found ? [found] : [];
      });
      const rest = available.filter((entry) => !wished.includes(entry));
      picked = [...wished, ...rest].slice(0, quantity);
      if (picked.length < quantity) {
        throw new ConflictError(
          picked.length === 0
            ? `Plus de ${name} disponible sur cette séance`
            : `Il ne reste que ${picked.length} ${name} sur cette séance`,
        );
      }
    }
    for (const entry of picked) {
      taken.add(entry.unit.id);
      planned.push({ needId: need.id, unit: entry.unit, allocationId: entry.allocationId });
    }
  }
  if (issues.length > 0) throw new ValidationError("Vérifie le matériel en rouge.", issues);
  return planned;
}

/**
 * Restreint les exemplaires proposés sur un événement (`needId` → exemplaires) ; liste vide :
 * plus de restriction. Les besoins inconnus sont ignorés.
 */
export function restrictEquipment(
  modules: EventModules,
  restrictions: Readonly<Record<string, string[]>>,
): EventModules {
  if (!modules.equipment) return modules;
  const needs = modules.equipment.needs.map((need) => {
    const unitIds = restrictions[need.id];
    if (unitIds === undefined) return need;
    const { unitIds: _previous, ...rest } = need;
    return unitIds.length > 0 ? { ...rest, unitIds } : rest;
  });
  return { ...modules, equipment: { ...modules.equipment, needs } };
}

/** Un besoin du formulaire d'inscription : ce que le client voit et choisit. */
export interface EquipmentOffer {
  needId: string;
  name: string;
  /** Exemplaires par place. */
  perSeat: number;
  required: boolean;
  chooser: EquipmentNeed["chooser"];
  /** Exemplaires libres parmi lesquels choisir (« L'élève choisit »). */
  options: Array<{ unitId: string; label: string; details: string[] }>;
  /** Combien d'exemplaires restent pour une inscription d'une place. */
  available: number;
}

/* ---------- Lieu ---------- */

/** Texte affiché pour un événement dont le lieu est « chez le client ». */
export const CLIENT_SITE_LABEL = "Chez toi";
/** Question ajoutée au formulaire quand l'atelier se déplace. */
export const CLIENT_ADDRESS_FIELD_KEY = "adresse_client";

/**
 * Lieu d'un nouvel événement d'après le module : adresse de l'espace (ou l'autre adresse du
 * module) à l'atelier, lien de visio en ligne. Ce que l'équipe saisit sur l'événement prime.
 */
export function eventPlace(
  location: LocationModule | undefined,
  entered: {
    locationName: string | null;
    locationAddress: string | null;
    onlineUrl: string | null;
  },
  workspaceAddress: string | null,
): { locationName: string | null; locationAddress: string | null; onlineUrl: string | null } {
  if (!location) return entered;
  switch (location.mode) {
    case "venue":
      return {
        ...entered,
        locationAddress: entered.locationAddress ?? location.address ?? workspaceAddress,
      };
    case "online":
      return { ...entered, onlineUrl: entered.onlineUrl ?? location.onlineUrl ?? null };
    case "client":
      return { ...entered, locationName: entered.locationName ?? CLIENT_SITE_LABEL };
  }
}

/* ---------- Intervenant ---------- */

/** Le membre est-il proposé pour ce type (liste vide ou absente : toute l'équipe) ? */
export const staffAllowed = (staff: StaffModule | undefined, memberId: string) =>
  !staff?.memberIds?.length || staff.memberIds.includes(memberId);

/* ---------- Résumés ---------- */

export interface ResourceNames {
  itemTypeNames?: Record<string, string>;
  memberNames?: Record<string, string>;
}

const LOCATION_LABELS = {
  venue: "À l'atelier",
  online: "En ligne",
  client: "Chez le client",
} as const;

export function resourceSummary(
  key: "equipment" | "location" | "staff",
  modules: EventModules,
  names: ResourceNames,
): string {
  if (key === "equipment") {
    const needs = modules.equipment?.needs ?? [];
    if (needs.length === 0) return "Aucun besoin pour l'instant";
    return needs
      .map((need) => {
        const label = names.itemTypeNames?.[need.itemTypeId] ?? "Matériel";
        const how = need.chooser === "student" ? "choisi par l'élève" : "attribué par l'atelier";
        return `${label} ${need.perSeat} par place (${need.required ? "obligatoire" : "facultatif"}, ${how})`;
      })
      .join(" · ");
  }
  if (key === "location") {
    const location = modules.location;
    if (!location) return "";
    return location.mode === "venue"
      ? `${LOCATION_LABELS.venue}${location.address ? ` · ${location.address}` : " · adresse de l'espace"}`
      : location.mode === "online"
        ? "En ligne · lien envoyé dans la confirmation et le rappel"
        : "Chez le client · adresse demandée à l'inscription";
  }
  const staff = modules.staff ?? {};
  const people = staff.memberIds?.length
    ? staff.memberIds.map((id) => names.memberNames?.[id] ?? "Membre").join(", ")
    : "Toute l'équipe";
  return `${people} · choisi sur chaque événement${staff.showOnPublicPage ? " · prénom affiché" : ""}`;
}
