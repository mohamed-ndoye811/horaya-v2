import { createEvent, createEventType } from "../events/use-cases";
import { createItem, setEventItemQuantity } from "../inventory/use-cases";
import type { Actor } from "../shared/actor";
import { addDays, fromZonedParts, toZonedParts, weekdayOf } from "../shared/time";
import type { Deps } from "../shared/unit-of-work";
import type { TenantSector } from "./workspace";

interface Starter {
  typeName: string;
  color: string;
  title: string;
  minutes: number;
  capacity: number;
  priceCents: number;
  /** Matériel prêté pendant la séance, déjà attribué à l'exemple. */
  item: { name: string; quantity: number } | null;
}

/** Séance exemple par secteur : de quoi voir tout le parcours avant d'écrire la sienne. */
export const STARTERS: Record<TenantSector, Starter> = {
  consulting: {
    typeName: "Formation",
    color: "#528D74",
    title: "Atelier découverte",
    minutes: 180,
    capacity: 12,
    priceCents: 0,
    item: null,
  },
  events: {
    typeName: "Événement",
    color: "#66537C",
    title: "Soirée de lancement",
    minutes: 180,
    capacity: 50,
    priceCents: 0,
    item: { name: "Chaise pliante", quantity: 50 },
  },
  culture: {
    typeName: "Atelier",
    color: "#D8BC66",
    title: "Atelier découverte",
    minutes: 120,
    capacity: 8,
    priceCents: 3500,
    item: { name: "Kit de matériel", quantity: 8 },
  },
  wellness: {
    typeName: "Cours collectif",
    color: "#528D74",
    title: "Cours d'essai",
    minutes: 90,
    capacity: 8,
    priceCents: 4500,
    item: { name: "Équipement prêté", quantity: 8 },
  },
  education: {
    typeName: "Cours",
    color: "#264489",
    title: "Cours d'essai",
    minutes: 60,
    capacity: 12,
    priceCents: 0,
    item: null,
  },
  hospitality: {
    typeName: "Sortie encadrée",
    color: "#528D74",
    title: "Sortie découverte",
    minutes: 180,
    capacity: 10,
    priceCents: 5500,
    item: { name: "Équipement prêté", quantity: 10 },
  },
  association: {
    typeName: "Activité",
    color: "#CF879C",
    title: "Activité découverte",
    minutes: 120,
    capacity: 15,
    priceCents: 0,
    item: null,
  },
  other: {
    typeName: "Séance",
    color: "#264489",
    title: "Séance découverte",
    minutes: 90,
    capacity: 10,
    priceCents: 0,
    item: null,
  },
};

/** Samedi suivant (au moins 2 jours plus tard) à 10 h, heure de l'espace. */
export function nextSaturdayMorning(now: Date, timeZone: string): Date {
  const today = toZonedParts(now, timeZone);
  const weekday = weekdayOf(today.year, today.month, today.day);
  let days = (5 - weekday + 7) % 7;
  if (days < 2) days += 7;
  return fromZonedParts({ ...addDays(today, days), hour: 10, minute: 0 }, timeZone);
}

/**
 * À la création d'un espace : un type d'événement, une séance exemple en brouillon et,
 * selon le secteur, le matériel qu'elle prête. L'organisateur la modifie ou la supprime ;
 * rien n'est visible du public tant qu'il ne la publie pas.
 */
export async function createStarterContent(
  deps: Deps,
  actor: Actor,
  sector: TenantSector,
  timeZone: string,
) {
  const starter = STARTERS[sector];
  const type = await createEventType(deps, actor, {
    name: starter.typeName,
    color: starter.color,
    defaultDurationMinutes: starter.minutes,
    defaultCapacity: starter.capacity,
    defaultPriceCents: starter.priceCents || null,
  });
  const startsAt = nextSaturdayMorning(deps.clock.now(), timeZone);
  const [event] = await createEvent(deps, actor, {
    eventTypeId: type.id,
    title: `${starter.title} (exemple)`,
    description:
      "Séance d'exemple préparée par Horaya : change le titre, la date, les places et le prix, puis publie-la. Tu peux aussi la supprimer.",
    startsAt,
    endsAt: new Date(startsAt.getTime() + starter.minutes * 60_000),
    timezone: timeZone,
    capacity: starter.capacity,
    priceCents: starter.priceCents,
    paymentMode: starter.priceCents > 0 ? "on_site" : "free",
  });
  if (event && starter.item) {
    const item = await createItem(deps, actor, {
      name: starter.item.name,
      quantity: starter.item.quantity,
    });
    await setEventItemQuantity(deps, actor, {
      eventId: event.id,
      itemId: item.id,
      quantity: starter.item.quantity,
    });
  }
  return { eventTypeId: type.id, eventId: event?.id ?? null };
}
